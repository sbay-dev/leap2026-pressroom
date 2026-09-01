const toggle = document.querySelector("[data-language]");
const requestedLanguage = new URLSearchParams(location.search).get("lang");
let language = requestedLanguage === "en" ? "en" : "ar";

applyLanguage();

toggle?.addEventListener("click", () => {
  language = language === "ar" ? "en" : "ar";
  applyLanguage();
});

function applyLanguage() {
  document.body.classList.toggle("lang-ar", language === "ar");
  document.body.classList.toggle("lang-en", language === "en");
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = language === "ar"
    ? "قالب Cepha التصوري · الإصدار المحفوظ"
    : "Cepha concept template · preserved version";
}
