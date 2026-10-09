import { OrderEditor } from "@/components/souki/order-editor"

export default async function OrderEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderEditor orderId={Number(id)} />
}
