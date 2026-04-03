// Payment product catalog — Infinite Voyager
export const COIN_PRODUCTS = [
  {
    id: 'starter_pack',
    coins: 500,
    bonus: 0,
    price: '$0.49',
    placement: 'coin_pack_starter',
  },
  {
    id: 'value_pack',
    coins: 1200,
    bonus: 200,
    price: '$0.99',
    placement: 'coin_pack_value',
  },
  {
    id: 'super_pack',
    coins: 2500,
    bonus: 0,
    price: '$1.99',
    badge: 'BEST VALUE',
    placement: 'coin_pack_super',
  },
];

// VIP Pass — $1/year subscription
export const VIP_PRODUCT = {
  id: 'vip_yearly',
  price: '$0.99',
  placement: 'vip_yearly_pass',
  type: 'subscription',
  period: 'yearly',
};

// Map placement IDs to coin amounts for fulfillment
export const PLACEMENT_REWARDS = {
  coin_pack_starter: 500,
  coin_pack_value: 1400, // 1200 + 200 bonus
  coin_pack_super: 2500,
  vip_yearly_pass: 'vip',
};
