import type { OrderAsset, OrderItemRecord, OrderRecord } from "./orders";

export function orderDesignKey(item: Pick<OrderItemRecord, "productId" | "designId" | "unitPrice">) {
  return item.designId ? JSON.stringify([item.productId, item.designId, item.unitPrice]) : undefined;
}

export function groupOrderArtwork(order: OrderRecord) {
  const groups: Array<{ item: OrderItemRecord; lines: Array<{ item: OrderItemRecord; index: number }>; assets: Array<{ asset: OrderAsset; itemIndex: number }>; quantity: number; total: number; sizes: string }> = [];
  const designs = new Map<string, typeof groups[number]>();
  order.items.forEach((item, index) => {
    const key = orderDesignKey(item);
    let group = key ? designs.get(key) : undefined;
    if (!group) {
      group = { item, lines: [], assets: [], quantity: 0, total: 0, sizes: "" };
      groups.push(group); if (key) designs.set(key, group);
    }
    group.lines.push({ item, index }); group.quantity += item.quantity; group.total += item.unitPrice * item.quantity;
    for (const asset of item.assets) {
      // Legacy orders may have the same filename/design under multiple size paths.
      if (!group.assets.some(entry => entry.asset.kind === asset.kind && entry.asset.fileName === asset.fileName)) group.assets.push({ asset, itemIndex: index });
    }
  });
  for (const group of groups) {
    const sizes = new Map<string, number>();
    for (const { item } of group.lines) if (item.size) sizes.set(item.size, (sizes.get(item.size) ?? 0) + item.quantity);
    group.sizes = [...sizes].map(([size, quantity]) => `${size} × ${quantity}`).join(", ");
  }
  return groups;
}
