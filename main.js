const fileInput = document.getElementById("fileInput");
const fileLabel = document.getElementById("fileLabel");
const dropZone = document.getElementById("dropZone");
const compressBtn = document.getElementById("compressBtn");
const resetBtn = document.getElementById("resetBtn");
const qualitySelect = document.getElementById("qualitySelect");
const status = document.getElementById("status");
const sizeInfo = document.getElementById("sizeInfo");
const progress = document.getElementById("progress");

const DEFAULT_API_BASE_URL = "https://mayola-headiest-omega.ngrok-free.dev";
let apiBaseUrl = DEFAULT_API_BASE_URL;

const configPromise = fetch(`./config.json?ts=${Date.now()}`)
  .then((res) => (res.ok ? res.json() : null))
  .then((data) => {
    if (data && typeof data.apiBaseUrl === "string" && data.apiBaseUrl.trim()) {
      apiBaseUrl = data.apiBaseUrl.trim();
    }
  })
  .catch(() => {});

let currentFile = null;

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatPercent = (value) => {
  const safe = Math.max(-999, Math.min(999, value));
  const sign = safe > 0 ? "-" : safe < 0 ? "+" : "";
  return `${sign}${Math.abs(safe).toFixed(1)}%`;
};

const setProgress = (value) => {
  progress.style.width = `${value}%`;
};

const resetUI = () => {
  currentFile = null;
  fileInput.value = "";
  fileLabel.textContent = "点击选择或拖拽 PDF 文件到此处";
  compressBtn.disabled = true;
  resetBtn.disabled = true;
  status.textContent = "等待选择文件";
  sizeInfo.textContent = "";
  setProgress(0);
};

fileInput.addEventListener("change", () => {
  if (fileInput.files.length === 0) {
    resetUI();
    return;
  }

  currentFile = fileInput.files[0];
  fileLabel.textContent = currentFile.name;
  compressBtn.disabled = false;
  resetBtn.disabled = false;
  status.textContent = "已选择文件，准备压缩";
  sizeInfo.textContent = `原始大小：${formatSize(currentFile.size)}`;
});

resetBtn.addEventListener("click", resetUI);

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-active");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-active");
  });
});

dropZone.addEventListener("drop", (event) => {
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;
  fileInput.files = files;
  fileInput.dispatchEvent(new Event("change"));
});

compressBtn.addEventListener("click", async () => {
  if (!currentFile) return;
  await configPromise;
  if (apiBaseUrl.includes("YOUR-RENDER-SERVICE")) {
    status.textContent = "请先配置服务端地址";
    compressBtn.disabled = false;
    return;
  }

  compressBtn.disabled = true;
  status.textContent = "正在压缩，请稍候…";
  setProgress(10);

  try {
    const formData = new FormData();
    formData.append("pdf", currentFile);
    formData.append("quality", qualitySelect.value);

    setProgress(40);

    const response = await fetch(`${apiBaseUrl}/compress`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let detail = "";
      try {
        const data = await response.json();
        if (data && data.error) detail = `（${data.error}）`;
      } catch (err) {
        try {
          const text = await response.text();
          if (text) detail = `（${text.slice(0, 120)}）`;
        } catch (err2) {
          detail = "";
        }
      }
      throw new Error(`压缩失败，状态码 ${response.status} ${detail}`);
    }

    setProgress(75);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFile.name.replace(/\.pdf$/i, "") + "_compressed.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setProgress(100);
    status.textContent = "压缩完成，已开始下载";
    const original = currentFile.size;
    const compressed = blob.size;
    const ratio = original > 0 ? (1 - compressed / original) * 100 : 0;
    const percentText = formatPercent(ratio);
    sizeInfo.textContent = `原始大小：${formatSize(original)}  →  新文件大小：${formatSize(compressed)}  |  体积变化：${percentText}`;
  } catch (err) {
    console.error(err);
    status.textContent = err instanceof Error ? err.message : "压缩失败，请更换 PDF 再试";
  } finally {
    compressBtn.disabled = false;
  }
});

resetUI();
