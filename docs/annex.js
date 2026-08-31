const body = document.body;

document.querySelector("[data-language]")?.addEventListener("click", () => {
  const next = body.classList.contains("lang-ar") ? "en" : "ar";
  body.classList.toggle("lang-ar", next === "ar");
  body.classList.toggle("lang-en", next === "en");
  document.documentElement.lang = next;
  document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
});

const { mountAdgCipher } = await import("./adg-cipher.js");
await mountAdgCipher(document.getElementById("annex-cipher"));
