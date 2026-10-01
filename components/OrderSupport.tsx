export function OrderSupport() {
  return <div className="order-support">
    <p><strong>Free shipping and courier delivery.</strong> Expected delivery: 3–4 working days after order confirmation.</p>
    <p>For order queries, or if your product has not arrived after 5 days, send your order number, name and delivery address. Our team will update you on your delivery.</p>
    <p><a href="https://wa.me/919744488876" target="_blank" rel="noopener noreferrer">WhatsApp: +91 9744488876</a><br /><a href="mailto:inkivoprint@gmail.com">inkivoprint@gmail.com</a> / <a href="mailto:graphyflex@gmail.com">graphyflex@gmail.com</a></p>
  </div>;
}

export function PaymentSupport({ status }: { status: "cancelled" | "processing" }) {
  return <div role="status"><p>{status === "cancelled" ? "Payment cancelled. Your order is not confirmed." : "Your payment is processing. Your order is not confirmed yet. Please wait for payment verification before trying again."} Need help? Contact <a href="tel:+919744488876">+91 9744488876</a> or <a href="https://wa.me/919744488876" target="_blank" rel="noopener noreferrer">message us on WhatsApp</a>.</p></div>;
}
