"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { parseCsv, readXlsx } from "@/lib/files.mjs";
import { readSchoolRoster } from "@/lib/student-import.mjs";
import "./student-file-import.css";

type Roster = Awaited<ReturnType<typeof readSchoolRoster>>;
type StudentRow = Roster["rows"][number] & { active?: number };

export function StudentFileImport({ space, disabled, onSave, onRefresh }: {
  space: string;
  disabled: boolean;
  onSave: (rows: StudentRow[], addOnly: boolean) => Promise<{ added?: number; skipped?: number }>;
  onRefresh: () => Promise<unknown>;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<Roster | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (preview && !dialog.current?.open) dialog.current?.showModal();
  }, [preview]);

  async function save(rows: StudentRow[], addOnly: boolean) {
    const result = await onSave(rows, addOnly);
    dialog.current?.close();
    const message = addOnly
      ? `Đã thêm ${result.added} học sinh. Bỏ qua ${result.skipped} mã đã có.`
      : "Đã nhập danh sách.";
    setNotice(message);
    try {
      await onRefresh();
    } catch {
      setNotice(message + " Tải lại trang để cập nhật danh sách.");
    }
  }

  async function readFile(file: File) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (file.size > 5_000_000) throw Error("Tệp tối đa 5 MB.");
      const extension = file.name.toLowerCase().split(".").at(-1);
      if (extension === "xls") {
        setPreview(await readSchoolRoster(file));
        return;
      }
      if (extension !== "xlsx" && extension !== "csv") {
        throw Error("Chọn tệp Excel .xls, .xlsx hoặc CSV.");
      }
      const rows = extension === "xlsx" ? await readXlsx(file) : parseCsv(await file.text());
      if (!["Mã học sinh", "code"].includes(rows[0]?.[0])) {
        throw Error("Cột đầu phải là Mã học sinh. Tiếp theo: Họ tên, Khối, Lớp, Trạng thái.");
      }
      await save(rows.slice(1).filter(row => row.some(Boolean)).map(row => ({
        code: row[0], name: row[1], grade: row[2], class: row[3],
        active: row[4] === "Vô hiệu hóa" ? 0 : 1,
      })), false);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview || busy || disabled) return;
    setBusy(true);
    setError("");
    try {
      await save(preview.rows, true);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="secondary" type="button" disabled={busy || disabled} onClick={() => picker.current?.click()}>
        <FileSpreadsheet size={17} />
        {busy && !preview ? "Đang đọc tệp…" : "Nhập Excel / CSV"}
      </button>
      <input ref={picker} type="file" aria-label="Tệp danh sách học sinh" accept=".xls,.xlsx,.csv" hidden
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void readFile(file);
        }}
      />
      {!preview && error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="student-import-notice" role="status">{notice}</p>}
      <dialog ref={dialog} className="student-import-dialog" aria-labelledby="student-import-title"
        onCancel={event => { if (busy) event.preventDefault(); }}
        onClose={() => { setPreview(null); setError(""); }}
      >
        {preview && <>
          <h2 id="student-import-title">Kiểm tra danh sách Excel</h2>
          <p><strong>{preview.rows.length} học sinh · Lớp {preview.className}</strong></p>
          <p>{space === "demo" ? "Môi trường thử nghiệm." : "Danh sách chính thức."} Chỉ thêm mã học sinh mới. Mã đã có sẽ được bỏ qua.</p>
          <div className="student-import-preview" role="region" aria-label="Danh sách học sinh trong tệp" tabIndex={0}>
            <table aria-label="Xem trước học sinh">
              <thead><tr><th scope="col">Mã học sinh</th><th scope="col">Họ và tên</th></tr></thead>
              <tbody>{preview.rows.map(row => (
                <tr key={row.code}><td>{row.code}</td><td>{row.name}</td></tr>
              ))}</tbody>
            </table>
          </div>
          {error && <p className="alert" role="alert">{error}</p>}
          <div className="button-row">
            <button className="secondary" type="button" disabled={busy} onClick={() => dialog.current?.close()}>Hủy</button>
            <button className="primary" type="button" disabled={busy || disabled} onClick={() => void confirm()}>
              {busy ? "Đang nhập…" : "Xác nhận nhập"}
            </button>
          </div>
        </>}
      </dialog>
    </>
  );
}
