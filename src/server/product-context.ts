import "server-only";
import { cookies } from "next/headers";
import { getProduct, listProducts } from "./repo";

export const SELECTED_PRODUCT_COOKIE = "nos-astra-product";

/** The product currently in focus. This is intentionally separate from a
 * product being active: several products may be active at the same time. */
export async function getSelectedProduct() {
  const productId = (await cookies()).get(SELECTED_PRODUCT_COOKIE)?.value;
  if (productId) {
    const product = await getProduct(productId);
    if (product?.active) return product;
  }

  const products = await listProducts();
  return products.find((product) => product.active) ?? products[0] ?? null;
}

