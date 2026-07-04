// Swizzled Root — wraps every page. We use it to mount the global
// "Ask my notes" RAG widget on all pages of the notes site.
//
// The launcher is mounted ONLY after the page has fully loaded (window
// 'load' + a short settle), so its animated icon never appears during the
// initial page load / paint.
import React, { useEffect, useState } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import AskNotes from "@site/src/components/AskNotes";

function DeferredAskNotes() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timer;
    const reveal = () => {
      // Small settle after load so it eases in once the page is calm.
      timer = setTimeout(() => setReady(true), 600);
    };
    if (document.readyState === "complete") {
      reveal();
    } else {
      window.addEventListener("load", reveal, { once: true });
    }
    return () => {
      clearTimeout(timer);
      window.removeEventListener("load", reveal);
    };
  }, []);

  if (!ready) return null;
  return <AskNotes />;
}

export default function Root({ children }) {
  return (
    <>
      {children}
      <BrowserOnly>{() => <DeferredAskNotes />}</BrowserOnly>
    </>
  );
}
