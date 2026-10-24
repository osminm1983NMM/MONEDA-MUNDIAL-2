// Solo escenarios INVENTADOS para una vista previa pública, sin Supabase ni dinero.
export const GUEST_HISTORY_PREVIEW_USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';

export function guestHistoryFixture() {
  return [
    {id:'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',kind:'transfer',
      source_user_id:OTHER_USER,destination_user_id:GUEST_HISTORY_PREVIEW_USER,
      amount_cents:12050,created_at:'2026-10-23T12:30:00Z'},
    {id:'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2',kind:'transfer',
      source_user_id:GUEST_HISTORY_PREVIEW_USER,destination_user_id:OTHER_USER,
      amount_cents:3525,created_at:'2026-10-23T11:45:00Z'},
    {id:'ccccccc3-cccc-4ccc-8ccc-ccccccccccc3',kind:'transfer',is_merchant_payment:true,
      source_user_id:GUEST_HISTORY_PREVIEW_USER,destination_user_id:OTHER_USER,
      amount_cents:1275,created_at:'2026-10-22T14:10:00Z'},
    {id:'ddddddd4-dddd-4ddd-8ddd-ddddddddddd4',kind:'transfer',is_merchant_payment:true,
      source_user_id:OTHER_USER,destination_user_id:GUEST_HISTORY_PREVIEW_USER,
      amount_cents:640,created_at:'2026-10-21T09:00:00Z'},
    {id:'eeeeeee5-eeee-4eee-8eee-eeeeeeeeeee5',kind:'contribution',
      source_user_id:GUEST_HISTORY_PREVIEW_USER,destination_user_id:null,
      amount_cents:900,created_at:'2026-10-20T16:05:00Z'},
  ];
}
