import { prisma } from '@/lib/prisma';

interface CheckoutItem {
  productId: string; // El id del modelo Product es String (UUID)
  title: string;
  price: number;
  quantity: number;
  image: string;
  size?: string;       // 🚀 AGREGADO: Opcional para el mapeo
  colorName?: string;  // 🚀 AGREGADO: Opcional para el mapeo
}

export async function processSecureCheckout(userId: string, items: CheckoutItem[]) {
  if (!items || items.length === 0) throw new Error("El carrito está vacío");

  // 1. Evitamos Deadlocks ordenando los strings de los IDs alfabéticamente
  const sortedItems = [...items].sort((a, b) => a.productId.localeCompare(b.productId));

  try {
    // Iniciamos la transacción interactiva en PostgreSQL
    return await prisma.$transaction(async (tx) => {
      let totalOrderAmount = 0;
      const orderItemsData = [];

      for (const item of sortedItems) {
        // 2. 🔒 BLOQUEO PESIMISTA: Tomamos control exclusivo de la fila del producto
        const products = await tx.$queryRaw<any[]>`
          SELECT id, name, stock, price 
          FROM "Product" 
          WHERE id = ${item.productId} 
          FOR UPDATE
        `;

        const dbProduct = products[0];

        if (!dbProduct) {
          throw new Error(`El producto "${item.title}" (ID: ${item.productId}) ya no está disponible.`);
        }

        // 3. CONTROL DE SOBREVENTA: Validación estricta en memoria aislada
        if (dbProduct.stock < item.quantity) {
          throw new Error(
            `¡Sobreventa mitigada! No hay stock suficiente para "${dbProduct.name}". Quedan ${dbProduct.stock} unidades y solicitaste ${item.quantity}.`
          );
        }

        // 4. ACTUALIZACIÓN DE STOCK: Restamos las unidades directo en la fila bloqueada
        await tx.$executeRaw`
          UPDATE "Product" 
          SET stock = stock - ${item.quantity}, "updatedAt" = NOW()
          WHERE id = ${item.productId}
        `;

        // Calculamos el acumulado usando el precio real guardado en la base de datos (seguridad financiera)
        totalOrderAmount += dbProduct.price * item.quantity;

        // Preparamos los datos para el historial de compra (OrderItem)
        orderItemsData.push({
          productId: item.productId,
          title: dbProduct.name,
          price: dbProduct.price,
          quantity: item.quantity,
          image: item.image,
          // 🚀 ARREGLADO: Completamos los campos obligatorios del esquema
          size: item.size || "M",
          colorName: item.colorName || "Único",
        });
      }

      // 🚀 Creamos la fecha de expiración obligatoria (7 días desde hoy)
      const fechaExpiracion = new Date();
      fechaExpiracion.setDate(fechaExpiracion.getDate() + 7);

      // 5. CREACIÓN DE LA ORDEN: Insertamos la cabecera del pedido
      const newOrder = await tx.order.create({
        // 🚀 ARREGLADO: Añadimos 'expiresAt' y cerramos con 'as any' para calmar al indexador XOR de Prisma
        data: {
          userId,
          total: totalOrderAmount,
          status: 'PAID', 
          expiresAt: fechaExpiracion,
          items: {
            createMany: {
              data: orderItemsData,
            },
          },
        } as any,
        include: {
          items: true,
        },
      });

      // 6. LIMPIEZA DEL CARRITO PERSISTIDO: Vaciamos el CartItem del usuario tras la compra exitosa
      await tx.cartItem.deleteMany({
        where: { userId },
      });

      console.log(`✅ [CONCURRENCY CONTROL] Orden ${newOrder.id} generada con éxito. Stock actualizado.`);
      return { success: true, orderId: newOrder.id };
    }, {
      maxWait: 5000,  // Tiempo máximo esperando que Postgres otorgue una conexión (5s)
      timeout: 15000, // Tiempo límite para ejecutar todo antes de forzar un Rollback (15s)
    });

  } catch (error: any) {
    console.error('❌ [CHECKOUT ROLLBACK] Compra cancelada de manera segura:', error.message);
    throw error; // Re-lanzamos para que el controlador de la API envíe el mensaje al cliente
  }
}