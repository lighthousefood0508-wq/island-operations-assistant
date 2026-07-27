export function renderVoiceRuntime(): string {
  return `<script>
    (() => {
      const supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
      function selectVoice() {
        if (!supported) return null;
        const voices = window.speechSynthesis.getVoices();
        return voices.find((voice) => voice.lang.toLowerCase() === "zh-tw")
          || voices.find((voice) => voice.lang.toLowerCase().startsWith("zh"))
          || null;
      }
      function speak(text) {
        if (!supported) return false;
        const message = String(text || "").trim();
        if (!message) return false;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = "zh-TW";
        utterance.rate = 1.02;
        utterance.pitch = 1;
        const voice = selectVoice();
        if (voice) utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
        return true;
      }
      function digits(value) {
        return String(value || "").split("").join(" ");
      }
      function itemText(items) {
        return (items || []).map((item) => item.posName + " " + item.quantity + " 份").join("，");
      }
      window.__rosVoice = Object.freeze({ supported, speak, digits, itemText });
    })();
  </script>`;
}
