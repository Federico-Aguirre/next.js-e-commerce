import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId requerido" }, { status: 400 });
    }

    // Consultamos de servidor a servidor la realidad del pago
    const paymentClient = new Payment(client);
    const mpPaymentInfo = await paymentClient.get({ id: Number(paymentId) });

    if (mpPaymentInfo.status === "approved") {
      return NextResponse.json({ isApproved: true });
    }

    return NextResponse.json({ isApproved: false }, { status: 400 });
  } catch (error) {
    console.error("Error validando pago:", error);
    return NextResponse.json({ isApproved: false }, { status: 500 });
  }
}