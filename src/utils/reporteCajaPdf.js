import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const moneda = valor => `$ ${Number(valor || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaAr = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC" });

function agregarPie(doc) {
  const paginas = doc.getNumberOfPages();
  for (let numero = 1; numero <= paginas; numero += 1) {
    doc.setPage(numero);
    doc.setDrawColor(220, 227, 232);
    doc.line(14, 198, 283, 198);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 134, 148);
    doc.text("Sistema hecho por Glidex.ar", 14, 203);
    doc.text(`Página ${numero} de ${paginas}`, 283, 203, { align: "right" });
  }
}

export function crearReporteCajaPdf({ desde, hasta, cajas }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const total = cajas.reduce((acum, caja) => ({
    ventas: acum.ventas + Number(caja.ventasTotal || 0),
    efectivo: acum.efectivo + Number(caja.efectivoCobrado || 0),
    transferencias: acum.transferencias + Number(caja.transferenciasCobradas || 0),
    extracciones: acum.extracciones + Number(caja.extraccionesTotal || 0),
    rendir: acum.rendir + Number(caja.efectivoEsperado || 0),
  }), { ventas: 0, efectivo: 0, transferencias: 0, extracciones: 0, rendir: 0 });

  doc.setFillColor(13, 148, 136);
  doc.rect(0, 0, 297, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("La Hilda", 14, 13);
  doc.setFontSize(14);
  doc.text("Reporte de caja", 14, 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Período: ${fechaAr(desde)} al ${fechaAr(hasta)}`, 283, 13, { align: "right" });
  doc.text(`Generado: ${new Date().toLocaleString("es-AR")}`, 283, 21, { align: "right" });

  const tarjetas = [
    ["Ventas entregadas", moneda(total.ventas)],
    ["Efectivo cobrado", moneda(total.efectivo)],
    ["Transferencias", moneda(total.transferencias)],
    ["Extracciones", moneda(total.extracciones)],
    ["Efectivo a rendir", moneda(total.rendir)],
  ];
  tarjetas.forEach(([titulo, valor], indice) => {
    const x = 14 + indice * 54;
    doc.setFillColor(indice === 4 ? 224 : 243, indice === 4 ? 247 : 246, indice === 4 ? 244 : 248);
    doc.roundedRect(x, 36, 49, 19, 2, 2, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 116, 132); doc.text(titulo, x + 3, 42);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(15, 23, 42); doc.text(valor, x + 3, 50);
  });

  autoTable(doc, {
    startY: 62,
    head: [["Fecha", "Camión / chofer", "Estado", "Entregas", "Ventas", "Efectivo", "Transferencias", "Extracciones", "A rendir", "Declarado", "Diferencia"]],
    body: cajas.map(caja => [
      fechaAr(caja.fecha), `${caja.camion.nombre}${caja.choferNombre ? `\n${caja.choferNombre}` : ""}`, caja.cerrado ? "Cerrada" : "Abierta",
      String(caja.pedidosEntregados || 0), moneda(caja.ventasTotal), moneda(caja.efectivoCobrado), moneda(caja.transferenciasCobradas),
      moneda(caja.extraccionesTotal), moneda(caja.efectivoEsperado), caja.efectivoDeclarado == null ? "-" : moneda(caja.efectivoDeclarado), caja.diferencia == null ? "-" : moneda(caja.diferencia),
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2, textColor: [51, 65, 85], lineColor: [220, 227, 232], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 35, 58], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 249, 250] },
    columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 30 }, 2: { cellWidth: 15 }, 3: { cellWidth: 17, halign: "center" } },
    margin: { left: 14, right: 14, bottom: 16 },
  });

  const productos = new Map();
  for (const caja of cajas) for (const producto of caja.productos || []) productos.set(producto.nombre, (productos.get(producto.nombre) || 0) + Number(producto.cantidad || 0));
  const extracciones = cajas.flatMap(caja => (caja.extracciones || []).map(item => [fechaAr(caja.fecha), caja.camion.nombre, item.responsable, item.concepto, moneda(item.monto)]));
  if (productos.size) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Productos entregados en el período", "Unidades"]],
      body: [...productos.entries()].sort((a, b) => b[1] - a[1]).map(([nombre, cantidad]) => [nombre, String(cantidad)]),
      theme: "striped", styles: { font: "helvetica", fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [13, 148, 136] },
      columnStyles: { 1: { halign: "right", cellWidth: 28 } }, margin: { left: 14, right: 155, bottom: 16 },
    });
  }
  if (extracciones.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Fecha", "Camión", "Responsable", "Motivo", "Monto"]], body: extracciones,
      theme: "striped", styles: { font: "helvetica", fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [220, 38, 38] },
      columnStyles: { 4: { halign: "right", cellWidth: 28 } }, margin: { left: 14, right: 14, bottom: 16 },
    });
  }
  agregarPie(doc);
  return doc;
}

export function descargarReporteCaja(datos) {
  const nombre = datos.desde === datos.hasta ? `caja-la-hilda-${datos.desde}.pdf` : `caja-la-hilda-${datos.desde}-a-${datos.hasta}.pdf`;
  crearReporteCajaPdf(datos).save(nombre);
}
