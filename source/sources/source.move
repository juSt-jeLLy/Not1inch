module sui_htlc_contract::htlc {
    use sui::object::{Self, UID, delete};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use std::vector;
    use sui::hash as sui_hash;
    use sui::event;
    use sui::address;

    //error codes
    const E_INVALID_SECRET: u64 = 0;
    const E_TIMELOCK_NOT_EXPIRED: u64 = 1;
    const E_ALREADY_CLAIMED: u64 = 2;
    const E_NOT_OWNER: u64 = 3;
    const E_ALREADY_FILLED: u64 = 3;
    const E_AUCTION_ENDED: u64 = 4;
    const E_PRICE_TOO_LOW: u64 = 5;

    //struct and event definitions
    public struct Order<phantom T> has key {
        id: UID,
        maker: address,
        resolver: address,
        secret_hash: vector<u8>,
        start_time: u64,
        duration_ms: u64,
        start_price: u64,
        reserve_price: u64,
        filled: bool,
    }

    public struct OrderAnnouncedEvent has copy, drop {
        order_id: ID,
        maker: address,
        secret_hash: vector<u8>,
    }
    
     public struct AuctionTickEvent has copy, drop {
        order_id: ID,
        current_price: u64,
    }

    public struct OrderFilledEvent has copy, drop {
        order_id: ID,
        resolver: address,
        fill_price: u64,
    }

    public struct HTLCSrcEscrowCreatedEvent has copy, drop {
        id: ID,
        maker: address,
        resolver: address,
        secret_hash: vector<u8>,
        expiry: u64,
        amount: u64,
        safety_deposit_amount: u64,
        isSrc: bool,
    }

    public struct HTLCDstEscrowCreatedEvent has copy, drop {
        id: ID,
        maker: address,
        resolver: address,
        secret_hash: vector<u8>,
        expiry: u64,
        amount: u64,
        safety_deposit_amount: u64,
        isSrc: bool,
    }

    public struct HTLCClaimedEvent has copy, drop {
        id: ID,
        resolver: address,
        secret: vector<u8>,
        amount: u64,
        safety_deposit_amount: u64,
    }

    public struct HTLCRefundedEvent has copy, drop {
        id: ID,
        maker: address,
        amount: u64,
        safety_deposit_amount: u64,
    }

    public struct HashedTimelockEscrow<phantom T> has key, store {
        id: UID,
        secret_hash: vector<u8>,
        timelock_expiration_ms: u64,
        maker_address: address,
        resolver_address: address,
        locked_balance: Balance<T>,
        claimed: bool,
        safety_deposit: Balance<0x2::sui::SUI>,
        isSrc: bool,
    }

     /// Maker announces an order and starts a simple Dutch auction
    public entry fun announce_order<T>(
        secret_hash: vector<u8>,
        start_price: u64,
        reserve_price: u64,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let maker = tx_context::sender(ctx);
        let start_time = clock::timestamp_ms(clock);
        let order = Order<T> {
            id: object::new(ctx),
            maker,
            resolver: @0x0 ,
            secret_hash,
            start_time,
            duration_ms,
            start_price,
            reserve_price,
            filled: false,
        };
        let oid = object::id(&order);
        event::emit(OrderAnnouncedEvent { order_id: oid, maker, secret_hash });
        transfer::share_object(order);
    }


    public entry fun auction_tick<T>(    
    order: &mut Order<T>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let now = clock::timestamp_ms(clock);

    let elapsed;
    if (now > order.start_time) {
        elapsed = now - order.start_time;
    } else {
        elapsed = 0;
    };

    let price_diff;
    if (elapsed >= order.duration_ms) {
        price_diff = order.start_price - order.reserve_price;
    } else {
        // linear decrease
        price_diff = (order.start_price - order.reserve_price) * elapsed / order.duration_ms;
    };

    let current_price = order.start_price - price_diff;
    event::emit(AuctionTickEvent {
        order_id: object::id(order),
        current_price
    });
}


    /// Resolver fills the order by supplying a bid >= current price
    public entry fun fill_order<T>(
        order: &mut Order<T>,
        bid_price: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let resolver = tx_context::sender(ctx);
        order.resolver = resolver;
        assert!(!order.filled, E_ALREADY_FILLED);
        let now = clock::timestamp_ms(clock);
        assert!(now <= order.start_time + order.duration_ms, E_AUCTION_ENDED);

        // compute current price
        let elapsed = now - order.start_time;
        let price_diff = (order.start_price - order.reserve_price) * elapsed / order.duration_ms;
        let current_price = order.start_price - price_diff;
        assert!(bid_price >= current_price, E_PRICE_TOO_LOW);

        order.filled = true;
        event::emit(OrderFilledEvent { order_id: object::id(order), resolver, fill_price: current_price });
    }

   
    public entry fun create_htlc_escrow_src<T>(
        order: &mut Order<T>,
        coins: vector<Coin<T>>,
        resolver_safety_deposit: Coin<0x2::sui::SUI>,
        secret_hash: vector<u8>,
        timelock_duration_ms: u64,
        resolver_address: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // let maker_address = tx_context::sender(ctx);
        let maker_address = order.maker;
        let resolver_address = order.resolver;
        internal_create_htlc_escrow(
            coins,
            resolver_safety_deposit,
            secret_hash,
            timelock_duration_ms,
            maker_address,
            resolver_address,
            true,
            clock,
            ctx
        );
    }

    
    public entry fun create_htlc_escrow_dst<T>(
        coins: vector<Coin<T>>,
        resolver_safety_deposit: Coin<0x2::sui::SUI>,
        secret_hash: vector<u8>,
        timelock_duration_ms: u64,
        maker_address: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let resolver_address = tx_context::sender(ctx);
        internal_create_htlc_escrow(
            coins,
            resolver_safety_deposit,
            secret_hash,
            timelock_duration_ms,
            maker_address,
            resolver_address,
            false,
            clock,
            ctx
        );
    }

    /// Shared logic for HTLC creation
    fun internal_create_htlc_escrow<T>(
        coins: vector<Coin<T>>,
        safety_deposit_coin: Coin<0x2::sui::SUI>,
        secret_hash: vector<u8>,
        timelock_duration_ms: u64,
        maker_address: address,
        resolver_address: address,
        isSrc: bool,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!vector::is_empty(&coins), 0);

        let mut coins_vec = coins;
        let mut total_amount = 0;
        let coin_zero = coin::zero<T>(ctx);
        let mut balance = coin::into_balance(coin_zero);

        while (!vector::is_empty(&coins_vec)) {
            let coin = vector::pop_back(&mut coins_vec);
            total_amount = total_amount + coin::value(&coin);
            balance::join(&mut balance, coin::into_balance(coin));
        };
        vector::destroy_empty(coins_vec);

        let current_ts = clock::timestamp_ms(clock);
        let expire = current_ts + timelock_duration_ms;

        let mut sd_balance = coin::into_balance(safety_deposit_coin);

        let htlc: HashedTimelockEscrow<T> = HashedTimelockEscrow {
            id: object::new(ctx),
            secret_hash,
            timelock_expiration_ms: expire,
            maker_address,
            resolver_address,
            locked_balance: balance,
            claimed: false,
            safety_deposit: sd_balance,
            isSrc: isSrc,
        };

        if (isSrc) {
            event::emit(HTLCSrcEscrowCreatedEvent {
                id: object::id(&htlc),
                maker: htlc.maker_address,
                resolver: htlc.resolver_address,
                secret_hash: htlc.secret_hash,
                expiry: htlc.timelock_expiration_ms,
                amount: total_amount,
                safety_deposit_amount: balance::value(&htlc.safety_deposit),
                isSrc: true,
            });
        } else {
            event::emit(HTLCDstEscrowCreatedEvent {
                id: object::id(&htlc),
                maker: htlc.maker_address,
                resolver: htlc.resolver_address,
                secret_hash: htlc.secret_hash,
                expiry: htlc.timelock_expiration_ms,
                amount: total_amount,
                safety_deposit_amount: balance::value(&htlc.safety_deposit),
                isSrc: false,
            });
        };

        transfer::share_object(htlc);
    }

    public entry fun claim_htlc<T>(
        htlc: &mut HashedTimelockEscrow<T>,
        secret: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!htlc.claimed, E_ALREADY_CLAIMED);
        assert!(clock::timestamp_ms(clock) < htlc.timelock_expiration_ms, E_TIMELOCK_NOT_EXPIRED);
        if(htlc.isSrc) {
            assert!(tx_context::sender(ctx) == htlc.resolver_address, E_NOT_OWNER);
        } else {
            assert!(tx_context::sender(ctx) == htlc.maker_address, E_NOT_OWNER);
        };
        let computed_hash = sui_hash::keccak256(&secret);
        assert!(computed_hash == htlc.secret_hash, E_INVALID_SECRET);

        // Transfer main locked funds
        let amount = balance::value(&htlc.locked_balance);
        let coin = coin::take(&mut htlc.locked_balance, amount, ctx);

        if(htlc.isSrc) {
        transfer::public_transfer(coin, htlc.resolver_address);
        } else {
        transfer::public_transfer(coin, htlc.maker_address);
        };

        // Transfer safety deposit
        let sd_amount = balance::value(&htlc.safety_deposit);
        let sd_coin = coin::take(&mut htlc.safety_deposit, sd_amount, ctx);
        transfer::public_transfer(sd_coin, htlc.resolver_address);

        htlc.claimed = true;

        event::emit(HTLCClaimedEvent {
        id: object::id(htlc),
        resolver: htlc.resolver_address,
        secret,
        amount,
        safety_deposit_amount: sd_amount,
            });
        
    }
    


//     fun internal_claim_htlc<T>(
//     htlc: &mut HashedTimelockEscrow<T>,
//     secret: vector<u8>,
//     clock: &Clock,
//     ctx: &mut TxContext,
// ) {
//     assert!(!htlc.claimed, E_ALREADY_CLAIMED);
//     assert!(clock::timestamp_ms(clock) < htlc.timelock_expiration_ms, E_TIMELOCK_NOT_EXPIRED);

//     let computed_hash = sui_hash::keccak256(&secret);
//     assert!(computed_hash == htlc.secret_hash, E_INVALID_SECRET);

//     htlc.claimed = true;

//     // Transfer main locked funds
//     let amount = balance::value(&htlc.locked_balance);
//     let coin = coin::take(&mut htlc.locked_balance, amount, ctx);
//     if(htlc.isSrc) {
//         transfer::public_transfer(coin, htlc.resolver_address);
//     } else {
//         transfer::public_transfer(coin, htlc.maker_address);
//     };
//     // Transfer safety deposit
//     let sd_amount = balance::value(&htlc.safety_deposit);
//     let sd_coin = coin::take(&mut htlc.safety_deposit, sd_amount, ctx);
//     transfer::public_transfer(sd_coin, htlc.resolver_address);

//     event::emit(HTLCClaimedEvent {
//         id: object::id(htlc),
//         resolver: htlc.resolver_address,
//         secret,
//         amount,
//         safety_deposit_amount: sd_amount,
//     });
// }

//     public entry fun claim_htlc_for_user<T>(
//     htlc: &mut HashedTimelockEscrow<T>,
//     secret: vector<u8>,
//     clock: &Clock,
//     ctx: &mut TxContext,
// ) {
//     assert!(!htlc.isSrc, E_NOT_OWNER);
//     assert!(tx_context::sender(ctx) == htlc.maker_address, E_NOT_OWNER);
//     internal_claim_htlc(htlc, secret, clock, ctx);
// }

//     public entry fun claim_htlc_for_resolver<T>(
//     htlc: &mut HashedTimelockEscrow<T>,
//     secret: vector<u8>,
//     clock: &Clock,
//     ctx: &mut TxContext,
// ) {
//     assert!(htlc.isSrc, E_NOT_OWNER);
//     assert!(tx_context::sender(ctx) == htlc.resolver_address, E_NOT_OWNER);
//     internal_claim_htlc(htlc, secret, clock, ctx);
// }

    /// Allow refund after expiry
    public entry fun recover_htlc_escrow<T>(
        htlc: &mut HashedTimelockEscrow<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        if (htlc.isSrc) {
            assert!(tx_context::sender(ctx) == htlc.maker_address, E_NOT_OWNER);
        } else {
            assert!(tx_context::sender(ctx) == htlc.resolver_address, E_NOT_OWNER);
        };

        assert!(!htlc.claimed, E_ALREADY_CLAIMED);
        assert!(clock::timestamp_ms(clock) >= htlc.timelock_expiration_ms, E_TIMELOCK_NOT_EXPIRED);

        let amount = balance::value(&htlc.locked_balance);
        let coin = coin::take(&mut htlc.locked_balance, amount, ctx);
        if (htlc.isSrc) {
            transfer::public_transfer(coin, htlc.maker_address);
        } else {
            transfer::public_transfer(coin, htlc.resolver_address);
        };

        let sd_amount = balance::value(&htlc.safety_deposit);
        let sd_coin = coin::take(&mut htlc.safety_deposit, sd_amount, ctx);
        transfer::public_transfer(sd_coin, htlc.resolver_address);

        htlc.claimed = true;

        event::emit(HTLCRefundedEvent {
            id: object::id(htlc),
            maker: htlc.maker_address,
            amount,
            safety_deposit_amount: sd_amount,
        });
    }
}