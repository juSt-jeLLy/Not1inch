module sui_htlc_contract::htlc {
    use sui::object::{Self, UID, delete, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use std::vector;
    use sui::hash as sui_hash;
    use sui::event;
    use sui::address;

    // Error codes
    const E_INVALID_SECRET: u64 = 0;
    const E_TIMELOCK_NOT_EXPIRED: u64 = 1;
    const E_ALREADY_CLAIMED: u64 = 2;
    const E_NOT_OWNER: u64 = 3;
    const E_AUCTION_ENDED: u64 = 4;
    const E_PRICE_TOO_LOW: u64 = 5;
    const E_NOT_CORRECT_RESOLVER: u64 = 6;
    const E_NOT_SRC_RESOLVER: u64 = 7;
    const E_NOT_DST_MAKER: u64 = 8;
    const E_INSUFFICIENT_REMAINING: u64 = 9;
    const E_INVALID_SECRET_COUNT: u64 = 10;
    const E_INVALID_MERKLE_PROOF: u64 = 11;
    const E_SECRET_INDEX_USED: u64 = 12;
    const E_ALREADY_FILLED: u64 = 13; // Reused for entire order filled
    const E_NOT_CORRECT_MAKER_OR_RESOVLER: u64 = 14;
    const E_SRC_ESCROW_ALREADY_EXIST: u64 = 15;
    const E_SRC_ESCROW_DOES_NOT_EXIST: u64 = 16;
    const E_ORDER_NOT_ACTIVE: u64 = 17;
    const E_FUNDS_LESS_THAN_FILL_PRICE: u64 = 18; 
    const E_NOT_RESOLVER: u64 = 19; // Used for HTLC cancellation
    const E_NOT_MAKER: u64 = 20; // Used for HTLC cancellation
    const E_NOT_SRC: u64 = 21; // Used for HTLC cancellation
    const E_MISMATCH_SECRET_COUNT: u64 = 22; // Used for partial fill secret index mismatch

    // Order status constants
    const STATUS_ANNOUNCED: u8 = 0;
    const STATUS_FILLED: u8 = 1;
    const STATUS_CANCELLED: u8 = 2;

    // Struct and event definitions

    public struct Order<phantom T> has key {
        id: UID,
        maker: address,
        resolver: address,
        secret_hash: vector<u8>,
        start_time: u64,
        duration_ms: u64,
        start_price: u64,
        reserve_price: u64,
        fill_price: u64, // This will be set when the order is filled
        status: u8,
    }

    public struct PartialFill has copy, drop, store {
        resolver: address,
        amount: u64,
        fill_price: u64,
        hash_lock_index_used: u64,
    }

    public struct PartialOrder<phantom T> has key {
        id: UID,
        maker: address,
        start_time: u64,
        duration_ms: u64,
        start_price: u64,
        reserve_price: u64,
        total_amount: u64,
        remaining: u64,
        parts_count: u64,
        merkle_root: vector<u8>,
        filled_parts_bitmap: vector<bool>,
        fills: vector<PartialFill>,
        status: u8,
    }

    // Events
    public struct OrderAnnouncedEvent has copy, drop {
        order_id: ID,
        maker: address,
        secret_hash: vector<u8>,
    }

    public struct PartialOrderAnnouncedEvent has copy, drop {
        order_id: ID,
        maker: address,
        total_amount: u64,
        start_price: u64,
        reserve_price: u64,
        duration_ms: u64,
        parts_count: u64,
        merkle_root: vector<u8>,
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

    public struct PartialOrderFilledEvent has copy, drop {
        order_id: ID,
        resolver: address,
        fill_amount: u64,
        fill_price: u64,
        remaining: u64,
        secret_hash: vector<u8>,
        secret_index: u64,
    }

    public struct HTLCSrcEscrowCreatedEvent has copy, drop {
        id: ID,
        maker: address,
        resolver: address,
        secret_hash: vector<u8>,
        expiry: u64, // General expiry for event
        amount: u64,
        safety_deposit_amount: u64,
        isSrc: bool,
    }

    public struct HTLCDstEscrowCreatedEvent has copy, drop {
        id: ID,
        maker: address,
        resolver: address,
        secret_hash: vector<u8>,
        expiry: u64, // General expiry for event
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
        caller: address, // Added caller to event for clarity on who refunded/canceled
        amount: u64,
        safety_deposit_amount: u64,
    }

    public struct HashedTimelockEscrow<phantom T> has key, store {
        id: UID,
        secret_hash: vector<u8>,
        finality_lock_expires_ms: u64,
        resolver_exclusive_unlock_expires_ms: u64,
        resolver_cancellation_expires_ms: u64,
        maker_cancellation_expires_ms: u64,
        public_cancellation_incentive_expires_ms: u64,
        maker_address: address,
        resolver_address: address,
        locked_balance: Balance<T>,
        claimed: bool,
        safety_deposit: Balance<0x2::sui::SUI>,
        isSrc: bool,
        order_id: ID,
        hash_lock_index: u64,
    }

    // --- Core Auction & Standard HTLC Functions ---

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
            resolver: @0x0,
            secret_hash,
            start_time,
            duration_ms,
            start_price,
            reserve_price,
            fill_price: 0, // Initially set to 0, will be updated when filled
            status: STATUS_ANNOUNCED,
        };
        let oid = object::id(&order);
        event::emit(OrderAnnouncedEvent { order_id: oid, maker, secret_hash });
        transfer::share_object(order);
    }

    public entry fun auction_tick<T>(
        order: &mut Order<T>,
        clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        let now = clock::timestamp_ms(clock);
        let elapsed = if (now > order.start_time) { now - order.start_time } else { 0 };
        let price_diff = if (elapsed >= order.duration_ms) {
            order.start_price - order.reserve_price
        } else {
            (order.start_price - order.reserve_price) * elapsed / order.duration_ms
        };
        let current_price = order.start_price - price_diff;
        event::emit(AuctionTickEvent { order_id: object::id(order), current_price });
    }

    
    public entry fun partial_auction_tick<T>(
        order: &mut PartialOrder<T>,
        clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        let now = clock::timestamp_ms(clock);
        let elapsed = if (now > order.start_time) { now - order.start_time } else { 0 };
        let price_diff = if (elapsed >= order.duration_ms) {
            order.start_price - order.reserve_price
        } else {
            (order.start_price - order.reserve_price) * elapsed / order.duration_ms
        };
        let current_price = order.start_price - price_diff;
        event::emit(AuctionTickEvent { order_id: object::id(order), current_price });
    }

    public entry fun fill_order<T>(
        order: &mut Order<T>,
        bid_price: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let resolver = tx_context::sender(ctx);
        assert!(order.status == STATUS_ANNOUNCED, E_ALREADY_FILLED);

        let now = clock::timestamp_ms(clock);
        assert!(now <= order.start_time + order.duration_ms, E_AUCTION_ENDED);

        let elapsed = now - order.start_time;
        let price_diff = (order.start_price - order.reserve_price) * elapsed / order.duration_ms;
        let current_price = order.start_price - price_diff;
        assert!(bid_price >= current_price, E_PRICE_TOO_LOW);
        order.fill_price = bid_price; 
        order.status = STATUS_FILLED;
        order.resolver = resolver;
        event::emit(OrderFilledEvent { order_id: object::id(order), resolver, fill_price: bid_price });
    }

    public entry fun add_safety_deposit<T>(
        htlc: &mut HashedTimelockEscrow<T>,
        deposit: Coin<0x2::sui::SUI>,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == htlc.resolver_address, E_NOT_OWNER);
        let sd = coin::into_balance(deposit);
        balance::join(&mut htlc.safety_deposit, sd);
    }

    public entry fun create_htlc_escrow_src<T>(
        order: &mut Order<T>,
        coins: vector<Coin<T>>,
        secret_hash: vector<u8>,
        finality_lock_duration_ms: u64,
        resolver_exclusive_unlock_duration_ms: u64,
        resolver_cancellation_duration_ms: u64,
        maker_cancellation_duration_ms: u64,
        public_cancellation_incentive_duration_ms: u64,
        _resolver_address: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(order.status == STATUS_ANNOUNCED, E_ORDER_NOT_ACTIVE);
        assert!(tx_context::sender(ctx) == order.maker, E_NOT_OWNER);
        assert!(order.secret_hash == secret_hash, E_INVALID_SECRET);

        // Ensure coins value matches order.fill_price
       let mut coins_clone = coins;
let mut total_amount = 0;
let mut i = 0;
while (i < vector::length(&coins_clone)) {
    let coin = vector::borrow(&coins_clone, i);
    total_amount = total_amount + coin::value(coin);
    i = i + 1;
};
assert!(total_amount >= order.fill_price, E_FUNDS_LESS_THAN_FILL_PRICE);

internal_create_htlc_escrow(
    coins_clone,
    coin::zero<0x2::sui::SUI>(ctx),
    secret_hash,
    finality_lock_duration_ms,
    resolver_exclusive_unlock_duration_ms,
    resolver_cancellation_duration_ms,
    maker_cancellation_duration_ms,
    public_cancellation_incentive_duration_ms,
    order.maker,
    order.resolver,
    true,
    object::id(order),
    0,
    clock,
    ctx
);

    }

    public entry fun create_htlc_escrow_dst<T>(
        coins: vector<Coin<T>>,
        resolver_safety_deposit: Coin<0x2::sui::SUI>,
        secret_hash: vector<u8>,
        finality_lock_duration_ms: u64,
        resolver_exclusive_unlock_duration_ms: u64,
        resolver_cancellation_duration_ms: u64,
        maker_cancellation_duration_ms: u64,
        public_cancellation_incentive_duration_ms: u64,
        maker_address: address,
        resolver_address: address,
        order_id: ID,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == resolver_address, E_NOT_OWNER);
        internal_create_htlc_escrow(
            coins,
            resolver_safety_deposit,
            secret_hash,
            finality_lock_duration_ms,
            resolver_exclusive_unlock_duration_ms,
            resolver_cancellation_duration_ms,
            maker_cancellation_duration_ms,
            public_cancellation_incentive_duration_ms,
            maker_address,
            resolver_address,
            false,
            order_id,
            0,
            clock,
            ctx
        );
    }

    fun internal_create_htlc_escrow<T>(
        coins: vector<Coin<T>>,
        safety_deposit_coin: Coin<0x2::sui::SUI>,
        secret_hash: vector<u8>,
        finality_lock_duration_ms: u64,
        resolver_exclusive_unlock_duration_ms: u64,
        resolver_cancellation_duration_ms: u64,
        maker_cancellation_duration_ms: u64,
        public_cancellation_incentive_duration_ms: u64,
        maker_address: address,
        resolver_address: address,
        is_src: bool,
        order_id: ID,
        hash_lock_index: u64,
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

        // Calculate expiry timestamps for each stage
        let finality_lock_expires = current_ts + finality_lock_duration_ms;
        let resolver_exclusive_unlock_expires = finality_lock_expires + resolver_exclusive_unlock_duration_ms;
        let resolver_cancellation_expires = finality_lock_expires + resolver_cancellation_duration_ms;
        let maker_cancellation_expires = finality_lock_expires + maker_cancellation_duration_ms;
        let public_cancellation_incentive_expires = resolver_exclusive_unlock_expires + public_cancellation_incentive_duration_ms;

        let sd_balance = coin::into_balance(safety_deposit_coin);

        let htlc: HashedTimelockEscrow<T> = HashedTimelockEscrow {
            id: object::new(ctx),
            secret_hash,
            finality_lock_expires_ms: finality_lock_expires,
            resolver_exclusive_unlock_expires_ms: resolver_exclusive_unlock_expires,
            resolver_cancellation_expires_ms: resolver_cancellation_expires,
            maker_cancellation_expires_ms: maker_cancellation_expires,
            public_cancellation_incentive_expires_ms: public_cancellation_incentive_expires,
            maker_address,
            resolver_address,
            locked_balance: balance,
            claimed: false,
            safety_deposit: sd_balance,
            isSrc: is_src,
            order_id: order_id,
            hash_lock_index,
        };

        if (is_src) {
            event::emit(HTLCSrcEscrowCreatedEvent {
                id: object::id(&htlc),
                maker: htlc.maker_address,
                resolver: htlc.resolver_address,
                secret_hash: htlc.secret_hash,
                expiry: htlc.maker_cancellation_expires_ms, // Emit longest expiry for general event
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
                expiry: htlc.resolver_cancellation_expires_ms, // Emit resolver's expiry for general event
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
        let now = clock::timestamp_ms(clock);
        assert!(now >= htlc.finality_lock_expires_ms, E_TIMELOCK_NOT_EXPIRED); // Must be past finality lock

        let computed_hash = sui_hash::keccak256(&secret);
        assert!(computed_hash == htlc.secret_hash, E_INVALID_SECRET);

        // Enforce exclusive claim period
        if (now < htlc.resolver_exclusive_unlock_expires_ms) {
            assert!(tx_context::sender(ctx) == htlc.resolver_address || tx_context::sender(ctx)== htlc.maker_address, E_NOT_CORRECT_MAKER_OR_RESOVLER);
            // if (htlc.isSrc) {
            //     assert!(tx_context::sender(ctx) == htlc.resolver_address, E_NOT_SRC_RESOLVER);
            // } else {
            //     assert!(tx_context::sender(ctx) == htlc.maker_address, E_NOT_DST_MAKER);
            // };
        } else {
            // After exclusive period, anyone with the secret can claim (public unlock phase)
        };

        let amount = balance::value(&htlc.locked_balance);
        let coin = coin::take(&mut htlc.locked_balance, amount, ctx);

        if (htlc.isSrc) {
            transfer::public_transfer(coin, htlc.resolver_address);
        } else {
            transfer::public_transfer(coin, htlc.maker_address);
        };

        let sd_amount = balance::value(&htlc.safety_deposit);
        let sd_coin = coin::take(&mut htlc.safety_deposit, sd_amount, ctx);
        transfer::public_transfer(sd_coin, htlc.resolver_address); // Safety deposit always goes back to original resolver if claimed via secret

        htlc.claimed = true;

        event::emit(HTLCClaimedEvent {
            id: object::id(htlc),
            resolver: htlc.resolver_address,
            secret,
            amount,
            safety_deposit_amount: sd_amount,
        });
    }

    // public entry fun recover_htlc_escrow<T>(
    //     htlc: &mut HashedTimelockEscrow<T>,
    //     clock: &Clock,
    //     ctx: &mut TxContext,
    // ) {
    //     assert!(!htlc.claimed, E_ALREADY_CLAIMED);
    //     let now = clock::timestamp_ms(clock);
    //     let sender = tx_context::sender(ctx);

    //     let locked_amount = balance::value(&htlc.locked_balance);
    //     let safety_deposit_amount = balance::value(&htlc.safety_deposit);

    //     let recipient_funds: address;
    //     let recipient_safety_deposit: address;

    //     // Stage 1: Resolver's Own Cancellation Window (A4/B4)
    //     if (now >= htlc.resolver_cancellation_expires_ms && now < htlc.public_cancellation_incentive_expires_ms) {
    //         assert!(sender == htlc.resolver_address, E_NOT_RESOLVER); // Only original resolver can cancel here
    //         if (htlc.isSrc) {
    //             recipient_funds = htlc.maker_address;
    //         } else {
    //             recipient_funds = htlc.resolver_address;
    //         };
    //         recipient_safety_deposit = htlc.resolver_address; // SD back to original resolver
    //     }
    //     // Stage 2: Public Cancellation Incentive (part of A5) - Any resolver can take SD if the original one fails
    //     else if (now >= htlc.public_cancellation_incentive_expires_ms && now < htlc.maker_cancellation_expires_ms) {
    //         // Here, sender should be a whitelisted resolver (if we add a ResolverRegistry).
    //         // For hackathon, we'll assume any sender after this time can be a 'public' resolver.
    //         recipient_funds = if (htlc.isSrc) { htlc.maker_address } else { htlc.resolver_address };
    //         recipient_safety_deposit = sender; // Safety deposit goes to the cancelling resolver as incentive
    //     }
    //     // Stage 3: Maker's Final Cancellation Window (A5)
    //     else if (now >= htlc.maker_cancellation_expires_ms) {
    //         assert!(htlc.isSrc, E_NOT_SRC); // Only applicable for source HTLCs
    //         assert!(sender == htlc.maker_address, E_NOT_MAKER); // Only maker can cancel their part
    //         recipient_funds = htlc.maker_address;
    //         recipient_safety_deposit = htlc.resolver_address; // SD back to original resolver (incentive period over)
    //     } else {
    //         abort E_TIMELOCK_NOT_EXPIRED; // No cancellation window is open yet
    //     };

    //     if (locked_amount > 0) {
    //         let coin = coin::take(&mut htlc.locked_balance, locked_amount, ctx);
    //         transfer::public_transfer(coin, recipient_funds);
    //     };
    //     if (safety_deposit_amount > 0) {
    //         let sd_coin = coin::take(&mut htlc.safety_deposit, safety_deposit_amount, ctx);
    //         transfer::public_transfer(sd_coin, recipient_safety_deposit);
    //     };

    //     htlc.claimed = true;

    //     event::emit(HTLCRefundedEvent {
    //         id: object::id(htlc),
    //         caller: sender,
    //         amount: locked_amount,
    //         safety_deposit_amount: safety_deposit_amount,
    //     });
    // }

    public entry fun recover_htlc_escrow<T>(
        htlc: &mut HashedTimelockEscrow<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!htlc.claimed, E_ALREADY_CLAIMED);
        let now = clock::timestamp_ms(clock);
        let sender = tx_context::sender(ctx);

        let locked_amount = balance::value(&htlc.locked_balance);
        let safety_deposit_amount = balance::value(&htlc.safety_deposit);

        let recipient_funds: address;
        let recipient_safety_deposit: address;

        // Stage 1: Resolver's Own Cancellation Window (A4/B4)
        if (now >= htlc.resolver_cancellation_expires_ms && now < htlc.public_cancellation_incentive_expires_ms) {
            assert!(sender == htlc.resolver_address, E_NOT_OWNER); // Use E_NOT_OWNER or specific resolver error
            if (htlc.isSrc) {
                recipient_funds = htlc.maker_address;
            } else { // DST HTLC
                recipient_funds = htlc.resolver_address;
            };
            recipient_safety_deposit = htlc.resolver_address; // SD back to original resolver
        }
        // Stage 2: Public Cancellation Incentive (part of A5)
        else if (now >= htlc.public_cancellation_incentive_expires_ms && now < htlc.maker_cancellation_expires_ms) {
            // TODO: Optional: assert! sender is a whitelisted resolver
            recipient_funds = if (htlc.isSrc) { htlc.maker_address } else { htlc.resolver_address };
            recipient_safety_deposit = sender; // Safety deposit as incentive
        }
        // Stage 3: Final Cancellation Window for Maker (SRC) or Resolver (DST)
        else if (now >= htlc.maker_cancellation_expires_ms) {
            if (htlc.isSrc) {
                assert!(sender == htlc.maker_address, E_NOT_OWNER); // Maker cancels SRC HTLC
                recipient_funds = htlc.maker_address;
            } else { // It's a DST HTLC
                assert!(sender == htlc.resolver_address, E_NOT_OWNER); // Original resolver cancels DST HTLC
                recipient_funds = htlc.resolver_address;
            };
            recipient_safety_deposit = htlc.resolver_address; // SD back to original resolver
        } else {
            abort E_TIMELOCK_NOT_EXPIRED; // No cancellation window is open yet
        };

        if (locked_amount > 0) {
            let coin = coin::take(&mut htlc.locked_balance, locked_amount, ctx);
            transfer::public_transfer(coin, recipient_funds);
        };
        if (safety_deposit_amount > 0) {
            let sd_coin = coin::take(&mut htlc.safety_deposit, safety_deposit_amount, ctx);
            transfer::public_transfer(sd_coin, recipient_safety_deposit);
        };

        htlc.claimed = true;

        event::emit(HTLCRefundedEvent {
            id: object::id(htlc),
            caller: sender,
            amount: locked_amount,
            safety_deposit_amount: safety_deposit_amount,
        });
    }

    // --- Functions for Partial Fills ---

    public entry fun partial_announce_order<T>(
        total_amount: u64,
        start_price: u64,
        reserve_price: u64,
        duration_ms: u64,
        parts_count: u64,
        merkle_root: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let maker = tx_context::sender(ctx);
        let start_time = clock::timestamp_ms(clock);

        assert!(parts_count > 0, E_INVALID_SECRET_COUNT);

        let mut filled_parts_bitmap = vector::empty<bool>();
        let mut i = 0;
        while (i <= parts_count) { // N+1 secrets, so size N+1
            vector::push_back(&mut filled_parts_bitmap, false);
            i = i + 1;
        };

        let order = PartialOrder<T> {
            id: object::new(ctx),
            maker,
            start_time,
            duration_ms,
            start_price,
            reserve_price,
            total_amount,
            remaining: total_amount,
            parts_count,
            merkle_root,
            filled_parts_bitmap,
            fills: vector::empty<PartialFill>(),
            status: STATUS_ANNOUNCED,
        };
        let oid = object::id(&order);
        event::emit(PartialOrderAnnouncedEvent { order_id: oid, maker, total_amount, start_price, reserve_price, duration_ms, parts_count, merkle_root });
        transfer::share_object(order);
    }

    public entry fun fill_order_partial<T>(
        order: &mut PartialOrder<T>,
        fill_amount: u64,
        bid_price: u64,
        target_secret_hash: vector<u8>,
        expected_secret_index: u64,
        // merkle_proof: vector<vector<u8>>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(order.status == STATUS_ANNOUNCED, E_ORDER_NOT_ACTIVE);
        assert!(order.remaining > 0, E_ALREADY_FILLED);
        let resolver = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock);

        assert!(now <= order.start_time + order.duration_ms, E_AUCTION_ENDED);
        let elapsed = now - order.start_time;
        let price_diff = if (elapsed >= order.duration_ms) {
            order.start_price - order.reserve_price
        } else {
            (order.start_price - order.reserve_price) * elapsed / order.duration_ms
        };
        let current_price = order.start_price - price_diff;
        assert!(bid_price >= current_price, E_PRICE_TOO_LOW);
        assert!(fill_amount <= order.remaining, E_INSUFFICIENT_REMAINING);

        // _isValidPartialFill logic 
        let current_filled_amount= order.total_amount - order.remaining;
        let new_filled_amount = current_filled_amount + fill_amount;
        let target_percentage_numerator = new_filled_amount * (order.parts_count + 1);
        let target_percentage_denominator = order.total_amount;
        let mut expected_index = target_percentage_numerator / target_percentage_denominator;
        if (target_percentage_numerator % target_percentage_denominator != 0) {
        expected_index = expected_index + 1;
        };
        assert!(expected_index == expected_secret_index, E_MISMATCH_SECRET_COUNT);
        // assert!(verify_merkle_proof(order.merkle_root, target_secret_hash, expected_secret_index, merkle_proof), E_INVALID_MERKLE_PROOF);
        assert!(expected_secret_index < vector::length(&order.filled_parts_bitmap), E_INVALID_SECRET);
        assert!(!*vector::borrow(&order.filled_parts_bitmap, expected_secret_index), E_SECRET_INDEX_USED);

        *vector::borrow_mut(&mut order.filled_parts_bitmap, expected_secret_index) = true;

        order.remaining = order.remaining - fill_amount;

        let fill = PartialFill {
            resolver,
            amount: fill_amount,
            fill_price: bid_price,
            hash_lock_index_used: expected_secret_index,
        };
        vector::push_back(&mut order.fills, fill);

        event::emit(PartialOrderFilledEvent {
            order_id: object::id(order),
            resolver,
            fill_amount,
            fill_price: bid_price,
            remaining: order.remaining,
            secret_hash: target_secret_hash,
            secret_index: expected_secret_index,
        });
    }

    public entry fun create_htlc_escrow_src_partial<T>(
        order: &mut PartialOrder<T>,
        coins: vector<Coin<T>>,
        secret_hash: vector<u8>,
        finality_lock_duration_ms: u64,
        resolver_exclusive_unlock_duration_ms: u64,
        resolver_cancellation_duration_ms: u64,
        maker_cancellation_duration_ms: u64,
        public_cancellation_incentive_duration_ms: u64,
        resolver_address: address,
        hash_lock_index: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) { 
        assert!(tx_context::sender(ctx) == order.maker, E_NOT_MAKER);
        internal_create_htlc_escrow(
            coins,
            coin::zero<0x2::sui::SUI>(ctx),
            secret_hash,
            finality_lock_duration_ms,
            resolver_exclusive_unlock_duration_ms,
            resolver_cancellation_duration_ms,
            maker_cancellation_duration_ms,
            public_cancellation_incentive_duration_ms,
            order.maker,
            resolver_address,
            true,
            object::id(order),
            hash_lock_index,
            clock,
            ctx
        );
    }

    public entry fun create_htlc_escrow_dst_partial<T>(
        coins: vector<Coin<T>>,
        resolver_safety_deposit: Coin<0x2::sui::SUI>,
        secret_hash: vector<u8>,
        finality_lock_duration_ms: u64,
        resolver_exclusive_unlock_duration_ms: u64,
        resolver_cancellation_duration_ms: u64,
        maker_cancellation_duration_ms: u64,
        public_cancellation_incentive_duration_ms: u64,
        maker_address: address,
        resolver_address: address,
        order_id: ID,
        hash_lock_index: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == resolver_address, E_NOT_RESOLVER);

        internal_create_htlc_escrow(
            coins,
            resolver_safety_deposit,
            secret_hash,
            finality_lock_duration_ms,
            resolver_exclusive_unlock_duration_ms,
            resolver_cancellation_duration_ms,
            maker_cancellation_duration_ms,
            public_cancellation_incentive_duration_ms,
            maker_address,
            resolver_address,
            false,
            order_id,
            hash_lock_index,
            clock,
            ctx
        );
    }

    // --- Internal Merkle Proof Verification Function ---
    fun verify_merkle_proof(
        root: vector<u8>,
        leaf: vector<u8>,
        index: u64,
        proof: vector<vector<u8>>,
    ): bool {
        let mut computed_hash = leaf; // 'computed_hash' needs to be mutable
        let mut current_index = index; // 'current_index' needs to be mutable

        let mut i = 0; // 'i' needs to be mutable
        while (i < vector::length(&proof)) {
            let proof_element = vector::borrow(&proof, i);
            let mut combined_hash; // 'combined_hash' needs to be mutable

            if (current_index % 2 == 0) {
                combined_hash = vector::empty<u8>();
                vector::append(&mut combined_hash, computed_hash); // Mutable borrow
                vector::append(&mut combined_hash, *proof_element); // Mutable borrow
            } else {
                combined_hash = vector::empty<u8>();
                vector::append(&mut combined_hash, *proof_element); // Mutable borrow
                vector::append(&mut combined_hash, computed_hash); // Mutable borrow
            };
            computed_hash = sui_hash::keccak256(&combined_hash);
            current_index = current_index / 2;
            i = i + 1;
        };

        computed_hash == root
    }
}
