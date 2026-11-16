(() => {
  "use strict";

  const SIZE = 1350; // kích thước gốc của khung
  const EXPORT_SCALE = 2; // ảnh tải về 2700 x 2700

  // Vùng ghi lời chúc trên tấm thiệp trắng (toạ độ khung gốc).
  // Tấm thiệp hơi nghiêng; chữ được xoay theo đúng góc này.
  const CARD = {
    cx: 478,
    cy: 858,
    angle: (-2.6 * Math.PI) / 180,
    left: -368,
    right: 330,
    top: -248,
    bottom: 236,
    // Nơ ở góc trên phải: các dòng chữ phía trên phải ngắn lại
    ribbonBottom: -140,
    ribbonRight: 196,
  };

  const WISH_FONTS = {
    hand: { family: '"Patrick Hand"', weight: "400", style: "normal", max: 62, lh: 1.28 },
    script: { family: '"Dancing Script"', weight: "700", style: "normal", max: 66, lh: 1.22 },
    serif: { family: '"Lora"', weight: "500", style: "italic", max: 52, lh: 1.42 },
  };

  const INK = "#163a7c";  const UI_FONT = '"Be Vietnam Pro"';

  const $ = (id) => document.getElementById(id);
  const canvas = $("preview");
  const ctx = canvas.getContext("2d");
  const els = {
    photo: $("photo"),
    drop: $("drop"),
    dropMain: $("dropMain"),
    dropSub: $("dropSub"),
    zoomRow: $("zoomRow"),
    zoom: $("zoom"),
    resetPhoto: $("resetPhoto"),
    name: $("name"),
    className: $("className"),
    wish: $("wish"),
    wishCount: $("wishCount"),
    download: $("download"),
    missing: $("missing"),
    desk: $("desk"),
    loading: $("loading"),
    stageHint: $("stageHint"),
  };

  const state = {
    template: null,
    logo: null,
    box: null, // vùng ảnh (ô tím) tìm được từ khung
    photo: null,
    zoom: 1,
    offX: 0,
    offY: 0,
    font: "hand",
  };

  // ---------- Tải tài nguyên ----------

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Không tải được " + src));
      img.src = src;
    });
  }

  // Tìm ô màu tím (magenta) trong khung để biết chính xác chỗ đặt ảnh.
  function findPhotoBox(img) {
    const c = document.createElement("canvas");
    c.width = SIZE;
    c.height = SIZE;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, SIZE, SIZE);
    const { data } = g.getImageData(0, 0, SIZE, SIZE);
    const isMagenta = (x, y) => {
      const i = (y * SIZE + x) * 4;
      return data[i] > 190 && data[i + 1] < 80 && data[i + 2] > 190;
    };
    let minX = SIZE, minY = SIZE, maxX = -1, maxY = -1;
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (isMagenta(x, y)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return { x: 975, y: 512, w: 330, h: 330, r: 28 };
    // Ước lượng bán kính bo góc theo đường chéo từ góc trên trái.
    let d = 0;
    while (d < 80 && !isMagenta(minX + d, minY + d)) d += 1;
    const r = Math.max(6, Math.round(d / (1 - Math.SQRT1_2)));
    const pad = 3; // phủ cả viền răng cưa của ô tím
    return {
      x: minX - pad,
      y: minY - pad,
      w: maxX - minX + 1 + pad * 2,
      h: maxY - minY + 1 + pad * 2,
      r: r + pad,
    };
  }

  // ---------- Vẽ ----------

  function roundRectPath(g, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  function photoGeometry() {
    const { box, photo, zoom } = state;
    const cover = Math.max(box.w / photo.width, box.h / photo.height);
    const s = cover * zoom;
    const dw = photo.width * s;
    const dh = photo.height * s;
    return { dw, dh, maxX: (dw - box.w) / 2, maxY: (dh - box.h) / 2 };
  }

  function clampOffset() {
    if (!state.photo) return;
    const { maxX, maxY } = photoGeometry();
    state.offX = Math.max(-maxX, Math.min(maxX, state.offX));
    state.offY = Math.max(-maxY, Math.min(maxY, state.offY));
  }

  function drawPhoto(g, forExport) {
    const { box, photo } = state;
    g.save();
    roundRectPath(g, box.x, box.y, box.w, box.h, box.r);
    g.clip();
    if (photo) {
      g.fillStyle = "#ffffff";
      g.fillRect(box.x, box.y, box.w, box.h);
      const { dw, dh } = photoGeometry();
      const cx = box.x + box.w / 2 + state.offX;
      const cy = box.y + box.h / 2 + state.offY;
      g.imageSmoothingQuality = "high";
      g.drawImage(photo, cx - dw / 2, cy - dh / 2, dw, dh);
    } else if (!forExport) {
      const grad = g.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
      grad.addColorStop(0, "#f3f8ff");
      grad.addColorStop(1, "#dbe8fb");
      g.fillStyle = grad;
      g.fillRect(box.x, box.y, box.w, box.h);
      const mx = box.x + box.w / 2;
      const my = box.y + box.h / 2 - 18;
      // biểu tượng người
      g.fillStyle = "#a9c2ea";
      g.beginPath();
      g.arc(mx, my - 24, 34, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(mx, my + 52, 62, 40, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = "#5f7fb8";
      g.font = `600 24px ${UI_FONT}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("Ảnh của bạn", mx, box.y + box.h - 48);
    }
    g.restore();
  }

  function fitSingleLine(g, text, fontFor, maxW, maxSize, minSize) {
    for (let size = maxSize; size >= minSize; size -= 1) {
      g.font = fontFor(size);
      if (g.measureText(text).width <= maxW) return size;
    }
    return minSize;
  }

  function wrapWords(g, text, maxW) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (g.measureText(test).width <= maxW) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawIdentity(g, forExport) {
    const { box } = state;
    const cx = box.x + box.w / 2;
    const maxW = box.w - 12; // giữ chữ trong bề ngang ô ảnh, không chạm cây bút
    const name = els.name.value.trim();
    const cls = els.className.value.trim();

    g.save();
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    let y = box.y + box.h + 62;

    // Họ tên
    const nameText = name ? name.toLocaleUpperCase("vi") : forExport ? "" : "HỌ VÀ TÊN";
    if (nameText) {
      const nameFont = (s) => `800 ${s}px ${UI_FONT}`;
      let size = fitSingleLine(g, nameText, nameFont, maxW, 38, 22);
      g.font = nameFont(size);
      let lines = [nameText];
      if (g.measureText(nameText).width > maxW) {
        // tên quá dài: chia hai dòng cân đối
        const words = nameText.split(/\s+/);
        let best = null;
        for (let k = 1; k < words.length; k += 1) {
          const a = words.slice(0, k).join(" ");
          const b = words.slice(k).join(" ");
          const wMax = Math.max(g.measureText(a).width, g.measureText(b).width);
          if (!best || wMax < best.wMax) best = { lines: [a, b], wMax };
        }
        lines = best ? best.lines : [nameText];
        size = fitSingleLine(g, lines.reduce((a, b) => (g.measureText(a).width > g.measureText(b).width ? a : b)), nameFont, maxW, 30, 16);
        g.font = nameFont(size);
      }
      g.fillStyle = name ? "#0f2f75" : "rgba(15, 47, 117, 0.35)";
      g.shadowColor = name ? "rgba(255, 255, 255, 0.9)" : "transparent";
      g.shadowBlur = 10;
      lines.forEach((l, i) => g.fillText(l, cx, y + i * size * 1.18));
      y += (lines.length - 1) * size * 1.18;
      g.shadowColor = "transparent";
    }

    // Lớp (sinh viên tự điền; tự thêm chữ "Lớp" nếu chưa có)
    y += 42;
    const classText = cls ? (/^lớp\b/i.test(cls) ? cls : "Lớp " + cls) : forExport ? "" : "Lớp";
    if (classText) {
      const classFont = (s) => `700 ${s}px ${UI_FONT}`;
      const size = fitSingleLine(g, classText, classFont, maxW, 28, 16);
      g.font = classFont(size);
      g.fillStyle = cls ? "#1f4fa8" : "rgba(31, 79, 168, 0.4)";
      g.shadowColor = cls ? "rgba(255, 255, 255, 0.9)" : "transparent";
      g.shadowBlur = 8;
      g.fillText(classText, cx, y);
      g.shadowColor = "transparent";
    }

    g.restore();
  }

  // Bố trí lời chúc trong vùng thiệp, tránh chiếc nơ ở góc trên phải.
  function layoutWish(g, text, size, lh, startY) {
    const lineH = size * lh;
    const paragraphs = text.split(/\n/);
    const lines = [];
    let y = startY;
    const rightAt = (top) => (top < CARD.ribbonBottom ? CARD.ribbonRight : CARD.right);
    for (const para of paragraphs) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push({ text: "", y });
        y += lineH * 0.6;
        continue;
      }
      let line = "";
      let i = 0;
      while (i < words.length) {
        const maxW = rightAt(y) - CARD.left;
        let w = words[i];
        // từ quá dài: cắt theo ký tự
        if (!line && g.measureText(w).width > maxW) {
          let cut = w.length;
          while (cut > 1 && g.measureText(w.slice(0, cut)).width > maxW) cut -= 1;
          lines.push({ text: w.slice(0, cut), y });
          y += lineH;
          words[i] = w.slice(cut);
          continue;
        }
        const test = line ? line + " " + w : w;
        if (g.measureText(test).width <= maxW) {
          line = test;
          i += 1;
        } else {
          lines.push({ text: line, y });
          y += lineH;
          line = "";
        }
      }
      if (line) {
        lines.push({ text: line, y });
        y += lineH;
      }
    }
    return { lines, height: y - startY, lineH };
  }

  function drawWish(g, forExport) {
    const raw = els.wish.value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
    const conf = WISH_FONTS[state.font];
    const fontFor = (s) => `${conf.style} ${conf.weight} ${s}px ${conf.family}`;
    const areaH = CARD.bottom - CARD.top;

    g.save();
    g.translate(CARD.cx, CARD.cy);
    g.rotate(CARD.angle);
    g.textAlign = "left";
    g.textBaseline = "middle";

    if (!raw) {
      if (!forExport) {
        g.font = `italic 500 34px ${UI_FONT}`;
        g.fillStyle = "rgba(22, 58, 124, 0.32)";
        g.textAlign = "center";
        g.fillText("Lời chúc của bạn sẽ hiện ở đây", (CARD.left + CARD.right) / 2, 0);
      }
      g.restore();
      return;
    }

    let chosen = null;
    for (let size = conf.max; size >= 16; size -= 1) {
      g.font = fontFor(size);
      const first = layoutWish(g, raw, size, conf.lh, CARD.top);
      if (first.height > areaH) continue;
      // canh giữa theo chiều dọc rồi bố trí lại (độ rộng dòng phụ thuộc vị trí)
      const centered = layoutWish(g, raw, size, conf.lh, CARD.top + (areaH - first.height) / 2);
      chosen =
        centered.height <= areaH && centered.lines[centered.lines.length - 1].y + centered.lineH <= CARD.bottom + 0.5
          ? centered
          : first;
      break;
    }
    if (!chosen) {
      g.font = fontFor(16);
      chosen = layoutWish(g, raw, 16, conf.lh, CARD.top);
    }
    g.fillStyle = INK;
    for (const l of chosen.lines) {
      if (l.y + chosen.lineH > CARD.bottom + 1) break;
      g.fillText(l.text, CARD.left, l.y + chosen.lineH / 2);
    }
    g.restore();
  }

  function drawCredit(g) {
    const pre = "Một sản phẩm của";
    const brand = "AFYLLX Digital";
    const fs = 17;
    const logo = 24;
    const gap = 7;
    const padX = 14;
    const h = 38;
    g.save();
    g.font = `500 ${fs}px ${UI_FONT}`;
    const wPre = g.measureText(pre).width;
    g.font = `700 ${fs}px ${UI_FONT}`;
    const wBrand = g.measureText(brand).width;
    const w = padX * 2 + wPre + gap + logo + gap - 2 + wBrand;
    const x = SIZE - 20 - w;
    const y = SIZE - 20 - h;
    roundRectPath(g, x, y, w, h, h / 2);
    g.fillStyle = "rgba(255, 255, 255, 0.82)";
    g.fill();
    g.textBaseline = "middle";
    g.textAlign = "left";
    g.fillStyle = "#3b5486";
    g.font = `500 ${fs}px ${UI_FONT}`;
    let cx = x + padX;
    g.fillText(pre, cx, y + h / 2 + 1);
    cx += wPre + gap;
    if (state.logo) g.drawImage(state.logo, cx, y + (h - logo) / 2, logo, logo);
    cx += logo + gap - 2;
    g.fillStyle = "#12306b";
    g.font = `700 ${fs}px ${UI_FONT}`;
    g.fillText(brand, cx, y + h / 2 + 1);
    g.restore();
    state.creditRect = { x, y, w, h };
  }

  // Đặt một liên kết trong suốt đúng lên dòng "Một sản phẩm của AFYLLX Digital" trong ảnh xem trước.
  function placeCreditLink() {
    const link = document.getElementById("creditLink");
    const r = state.creditRect;
    if (!link || !r) return;
    const pct = (v) => (v / SIZE) * 100 + "%";
    Object.assign(link.style, { left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) });
    link.hidden = false;
  }

  function render(g, forExport) {
    g.clearRect(0, 0, SIZE, SIZE);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(state.template, 0, 0, SIZE, SIZE);
    drawPhoto(g, forExport);
    drawIdentity(g, forExport);
    drawWish(g, forExport);
    drawCredit(g);
  }

  let queued = false;
  function requestRender() {
    if (queued || !state.template) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render(ctx, false);
    });
  }

  // ---------- Trạng thái biểu mẫu ----------

  function missingItems() {
    const list = [];
    if (!state.photo) list.push("ảnh");
    if (!els.name.value.trim()) list.push("họ và tên");
    if (!els.className.value.trim()) list.push("lớp");
    if (!els.wish.value.trim()) list.push("lời chúc");
    return list;
  }

  function updateStatus() {
    const miss = missingItems();
    const ready = miss.length === 0 && !!state.template;
    els.download.disabled = !ready;
    els.missing.classList.toggle("done", ready);
    els.missing.textContent = ready ? "Đã đủ thông tin, bạn có thể tải ảnh" : "Còn thiếu: " + miss.join(", ");
    const n = els.wish.value.length;
    const max = Number(els.wish.maxLength);
    els.wishCount.textContent = `${n}/${max}`;
    els.wishCount.classList.toggle("near", n > max * 0.85);
  }

  function onChange() {
    updateStatus();
    requestRender();
  }

  // ---------- Ảnh ----------

  async function setPhotoFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      els.dropSub.textContent = "Tệp này không phải ảnh, hãy chọn tệp JPG hoặc PNG";
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      state.photo = img;
      state.zoom = 1;
      state.offX = 0;
      state.offY = 0;
      els.zoom.value = "1";
      els.zoomRow.hidden = false;
      els.stageHint.hidden = false;
      els.drop.classList.add("has-photo");
      els.dropMain.textContent = "Đổi ảnh khác";
      els.dropSub.textContent = file.name;
      canvas.classList.add("can-drag");
      onChange();
    } catch {
      els.dropSub.textContent = "Không đọc được ảnh này, hãy thử ảnh khác";
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  els.photo.addEventListener("change", () => setPhotoFile(els.photo.files[0]));

  ["dragenter", "dragover"].forEach((t) =>
    document.addEventListener(t, (e) => {
      e.preventDefault();
      els.drop.classList.add("over");
    })
  );
  ["dragleave", "drop"].forEach((t) =>
    document.addEventListener(t, (e) => {
      e.preventDefault();
      if (t === "drop" || e.target === document.documentElement) els.drop.classList.remove("over");
    })
  );
  document.addEventListener("drop", (e) => {
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if (file) setPhotoFile(file);
  });

  function setZoom(z) {
    state.zoom = Math.max(1, Math.min(3, z));
    els.zoom.value = String(state.zoom);
    clampOffset();
    requestRender();
  }

  els.zoom.addEventListener("input", () => setZoom(Number(els.zoom.value)));
  els.resetPhoto.addEventListener("click", () => {
    state.offX = 0;
    state.offY = 0;
    setZoom(1);
  });

  function toTemplate(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * SIZE) / r.width, y: ((e.clientY - r.top) * SIZE) / r.height, scale: SIZE / r.width };
  }

  function inBox(p) {
    const b = state.box;
    return b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  // Trên điện thoại: chạm vào ô ảnh thì kéo ảnh, chạm chỗ khác vẫn cuộn trang bình thường.
  canvas.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (state.photo && t && inBox(toTemplate(t))) e.preventDefault();
    },
    { passive: false }
  );

  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    const p = toTemplate(e);
    if (!inBox(p)) return;
    if (!state.photo) {
      els.photo.click();
      return;
    }
    drag = { x: p.x, y: p.y, offX: state.offX, offY: state.offY };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = toTemplate(e);
    canvas.style.cursor = !drag && inBox(p) ? (state.photo ? "grab" : "pointer") : "";
    if (!drag) return;
    state.offX = drag.offX + (p.x - drag.x);
    state.offY = drag.offY + (p.y - drag.y);
    clampOffset();
    requestRender();
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!state.photo || !inBox(toTemplate(e))) return;
      e.preventDefault();
      setZoom(state.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06));
    },
    { passive: false }
  );

  // ---------- Chữ ----------

  [els.name, els.className, els.wish].forEach((el) => el.addEventListener("input", onChange));
  document.querySelectorAll('input[name="font"]').forEach((r) =>
    r.addEventListener("change", () => {
      state.font = r.value;
      requestRender();
    })
  );

  // ---------- Tải ảnh ----------

  function slug(s) {
    return s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  els.desk.addEventListener("submit", (e) => {
    e.preventDefault();
    if (missingItems().length) {
      updateStatus();
      return;
    }
    const out = document.createElement("canvas");
    out.width = SIZE * EXPORT_SCALE;
    out.height = SIZE * EXPORT_SCALE;
    const g = out.getContext("2d");
    g.scale(EXPORT_SCALE, EXPORT_SCALE);
    render(g, true);
    els.download.disabled = true;
    els.download.textContent = "Đang tạo ảnh…";
    out.toBlob((blob) => {
      els.download.textContent = "Tải ảnh về";
      updateStatus();
      if (!blob) {
        els.missing.textContent = "Không tạo được ảnh, hãy thử lại";
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `loi-chuc-tri-an-20-11-${slug(els.name.value) || "sinh-vien"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      els.missing.classList.add("done");
      els.missing.textContent = "Đã tải ảnh về máy";
    }, "image/png");
  });

  // ---------- Khởi động ----------

  async function start() {
    const sample = "Lời chúc tri ân thầy cô ĐẶNG Ỷ Ữ";
    const fontLoads = [
      `800 40px ${UI_FONT}`,
      `700 20px ${UI_FONT}`,
      `600 28px ${UI_FONT}`,
      `500 20px ${UI_FONT}`,
      `italic 500 34px ${UI_FONT}`,
      ...Object.values(WISH_FONTS).map((f) => `${f.style} ${f.weight} 40px ${f.family}`),
    ].map((f) => document.fonts.load(f, sample).catch(() => null));
    try {
      const [template, logo] = await Promise.all([
        loadImage("assets/khung-tri-an.webp"),
        loadImage("assets/afyllx-logo.png").catch(() => null),
        ...fontLoads,
      ]);
      state.template = template;
      state.logo = logo;
      state.box = findPhotoBox(template);
      els.loading.remove();
      updateStatus();
      render(ctx, false);
      placeCreditLink();
      document.fonts.ready.then(() => {
        render(ctx, false);
        placeCreditLink();
      });
    } catch (err) {
      els.loading.textContent = "Không tải được khung ảnh. Hãy mở trang qua MO_TRI_AN.cmd";
    }
  }

  start();
})();
