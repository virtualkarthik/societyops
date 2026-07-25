import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../api/client";

interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  current_stock: number | null;
  reorder_level: number | null;
  linked_asset_type: string | null;
}

interface InventoryTxn {
  id: number;
  item_id: number;
  txn_type: "PURCHASE" | "CONSUME";
  quantity: number;
  cost: number | null;
  txn_date: string;
}

function AddItemModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", unit: "Nos", current_stock: "", reorder_level: "", linked_asset_type: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => api.post("/inventory/items", {
      name: form.name,
      unit: form.unit,
      current_stock: form.current_stock ? Number(form.current_stock) : null,
      reorder_level: form.reorder_level ? Number(form.reorder_level) : null,
      linked_asset_type: form.linked_asset_type || null,
    }),
    onSuccess: () => {
      toast.success("Item added");
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      onClose();
    },
    onError: () => toast.error("Failed to add item"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-4 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Add Inventory Item</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required
              placeholder="e.g. Chlorine tablets"
              className="w-full border rounded-lg px-3 py-2.5 text-base" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
              <select value={form.unit} onChange={(e) => set("unit", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-base">
                {["Nos", "Kg", "L", "Boxes", "Bags", "Rolls", "Mtrs"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
              <input type="number" step="0.1" value={form.current_stock} onChange={(e) => set("current_stock", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-base" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
              <input type="number" step="0.1" value={form.reorder_level} onChange={(e) => set("reorder_level", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-base" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Linked Asset Type</label>
              <select value={form.linked_asset_type} onChange={(e) => set("linked_asset_type", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-base">
                <option value="">None</option>
                {["STP", "BOREWELL", "DG", "LIFT", "FIRE", "PUMP"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name}
            className="w-full bg-brand text-white font-semibold py-3 rounded-xl text-base disabled:opacity-60">
            {mutation.isPending ? "Adding…" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TxnModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    txn_type: "CONSUME" as "PURCHASE" | "CONSUME",
    quantity: "",
    cost: "",
    txn_date: new Date().toISOString().slice(0, 10),
  });

  const mutation = useMutation({
    mutationFn: () => api.post("/inventory/transactions", {
      item_id: item.id,
      txn_type: form.txn_type,
      quantity: Number(form.quantity),
      cost: form.cost ? Number(form.cost) : null,
      txn_date: form.txn_date,
    }),
    onSuccess: () => {
      toast.success(form.txn_type === "PURCHASE" ? "Purchase recorded" : "Usage recorded");
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-txns"] });
      onClose();
    },
    onError: () => toast.error("Failed to record transaction"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-4 flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-gray-800">Record Transaction</h2>
            <p className="text-xs text-gray-500 mt-0.5">{item.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["PURCHASE", "CONSUME"] as const).map((t) => (
              <button key={t} type="button"
                onClick={() => setForm((f) => ({ ...f, txn_type: t }))}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.txn_type === t ? "bg-brand text-white border-brand" : "bg-white text-gray-600 border-gray-200"}`}>
                {t === "PURCHASE" ? "📦 Purchase" : "🔧 Consume"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({item.unit}) *</label>
              <input type="number" step="0.1" value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} required
                className="w-full border rounded-lg px-3 py-2.5 text-base" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost (₹)</label>
              <input type="number" step="0.01" value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2.5 text-base" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" value={form.txn_date}
              onChange={(e) => setForm((f) => ({ ...f, txn_date: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2.5 text-base" />
          </div>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.quantity}
            className="w-full bg-brand text-white font-semibold py-3 rounded-xl text-base disabled:opacity-60">
            {mutation.isPending ? "Saving…" : "Record"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InventoryPage() {
  const qc = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [txnItem, setTxnItem] = useState<InventoryItem | null>(null);

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-items"],
    queryFn: () => api.get<InventoryItem[]>("/inventory/items").then((r) => r.data),
  });

  const { data: txns = [] } = useQuery<InventoryTxn[]>({
    queryKey: ["inventory-txns"],
    queryFn: () => api.get<InventoryTxn[]>("/inventory/transactions").then((r) => r.data),
  });

  const lowStock = items.filter((i) => i.reorder_level !== null && (i.current_stock ?? 0) <= i.reorder_level);
  const recentTxns = [...txns].sort((a, b) => new Date(b.txn_date).getTime() - new Date(a.txn_date).getTime()).slice(0, 10);

  return (
    <div className="max-w-3xl mx-auto">
      {showAddItem && <AddItemModal onClose={() => setShowAddItem(false)} />}
      {txnItem && <TxnModal item={txnItem} onClose={() => { setTxnItem(null); qc.invalidateQueries({ queryKey: ["inventory-items"] }); }} />}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Consumables & spare parts stock</p>
        </div>
        <button onClick={() => setShowAddItem(true)}
          className="bg-brand text-white px-5 py-2.5 rounded-lg font-medium text-sm min-h-[44px] hover:bg-brand-dark">
          + Add Item
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Total Items</p>
          <p className="text-2xl font-bold text-gray-800">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Low Stock</p>
          <p className={`text-2xl font-bold ${lowStock.length > 0 ? "text-red-600" : "text-green-700"}`}>{lowStock.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Txns This Month</p>
          <p className="text-2xl font-bold text-gray-800">
            {txns.filter((t) => {
              const d = new Date(t.txn_date); const n = new Date();
              return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
            }).length}
          </p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="font-semibold text-red-700 text-sm mb-1">⚠ Low Stock Alert</p>
          <p className="text-xs text-red-600">{lowStock.map((i) => `${i.name} (${i.current_stock ?? 0} ${i.unit})`).join(" · ")}</p>
        </div>
      )}

      {/* Items table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">Stock Items</h2>
          {isLoading && <span className="text-xs text-gray-400">Loading…</span>}
        </div>
        {items.length === 0 && !isLoading ? (
          <div className="text-center text-gray-400 py-12 text-sm">
            <p className="text-3xl mb-2">📦</p>
            <p>No items yet — click "+ Add Item" to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => {
              const isLow = item.reorder_level !== null && (item.current_stock ?? 0) <= item.reorder_level;
              return (
                <div key={item.id} className={`px-5 py-4 flex items-center justify-between gap-3 ${isLow ? "bg-red-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">{item.name}</span>
                      {item.linked_asset_type && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{item.linked_asset_type}</span>
                      )}
                      {isLow && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Low Stock</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      <span className={`font-semibold ${isLow ? "text-red-600" : "text-gray-800"}`}>
                        {item.current_stock ?? 0}
                      </span> {item.unit}
                      {item.reorder_level !== null && <span className="text-gray-400"> · reorder at {item.reorder_level}</span>}
                    </p>
                  </div>
                  <button onClick={() => setTxnItem(item)}
                    className="shrink-0 border border-brand text-brand text-xs font-semibold px-3 py-2 rounded-lg hover:bg-brand hover:text-white transition-colors">
                    + Transaction
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent transactions */}
      {recentTxns.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-700">Recent Transactions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Cost (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentTxns.map((txn) => {
                  const item = items.find((i) => i.id === txn.item_id);
                  return (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{new Date(txn.txn_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{item?.name ?? `Item #${txn.item_id}`}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${txn.txn_type === "PURCHASE" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                          {txn.txn_type === "PURCHASE" ? "Purchase" : "Consume"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{txn.quantity} {item?.unit ?? ""}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{txn.cost != null ? `₹${txn.cost.toLocaleString()}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
