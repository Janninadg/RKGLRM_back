export const CHAT_CRITICAL_ACTIONS = new Map([
  ['SEND_MESSAGE', {
    desc: 'Enviar mensaje en chat trade',
    exclusiveGroup: null
  }],
  ['RELEASE_ITEM', {
    desc: 'Vendedor libera el item',
    exclusiveGroup: 'TRADE_FINAL_ACTION'
  }],
  ['CONFIRM_PAYMENT', {
    desc: 'Comprador confirma pago',
    exclusiveGroup: null
  }],
  ['CANCEL_CHAT_RETURN', {
    desc: 'El vendedor cancela el chat y se retorna el item a su inventario',
    exclusiveGroup: 'TRADE_FINAL_ACTION'
  }],
  ['CANCEL_CHAT_REPOST', {
    desc: 'El vendedor cancela el chat y se republica el item en tienda',
    exclusiveGroup: 'TRADE_FINAL_ACTION'
  }],
  ['END_CHAT', {
    desc: 'Finalizando chat',
    exclusiveGroup: null
  }],
]);