/* iKanban landing page enhancements.
   The page is fully readable without this file. Every enhancement is
   optional, feature-detected and fail-safe. */
(() => {
  "use strict";

  const root = document.documentElement;

  try {
    root.classList.add("js");
    init();
  } catch (error) {
    // Never leave content hidden because an enhancement failed.
    root.classList.remove("js");
    console.error("iKanban landing page enhancement failed", error);
  }

  function init() {
    initHeaderState();
    initMobileNavigation();
    initScrollSpy();
    initReveal();
    initCopyButtons();
    initFooterYear();
  }

  function initHeaderState() {
    const header = document.querySelector(".site-header");
    if (!header) {
      return;
    }

    let scheduled = false;
    const update = () => {
      scheduled = false;
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    const onScroll = () => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function initMobileNavigation() {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.getElementById("primary-navigation");
    if (!toggle || !nav) {
      return;
    }

    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.classList.toggle("is-open", open);
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a")) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (
        toggle.getAttribute("aria-expanded") === "true" &&
        event.target instanceof Node &&
        !nav.contains(event.target) &&
        !toggle.contains(event.target)
      ) {
        setOpen(false);
      }
    });

    const desktop = window.matchMedia("(min-width: 901px)");
    const closeOnDesktop = (event) => {
      if (event.matches) {
        setOpen(false);
      }
    };
    if (typeof desktop.addEventListener === "function") {
      desktop.addEventListener("change", closeOnDesktop);
    } else if (typeof desktop.addListener === "function") {
      desktop.addListener(closeOnDesktop);
    }
  }

  function initScrollSpy() {
    const links = Array.from(document.querySelectorAll('.nav-link[href^="#"]'));
    if (links.length === 0) {
      return;
    }

    const sections = links
      .map((link) => {
        const id = link.getAttribute("href")?.slice(1);
        const section = id ? document.getElementById(id) : null;
        return section ? { id, section, link } : null;
      })
      .filter(Boolean);

    if (sections.length === 0) {
      return;
    }

    const setActive = (id) => {
      for (const entry of sections) {
        if (entry.id === id) {
          entry.link.setAttribute("aria-current", "true");
        } else {
          entry.link.removeAttribute("aria-current");
        }
      }
    };

    const updateFromScroll = () => {
      const marker = window.innerHeight * 0.38;
      let current = sections[0];
      for (const entry of sections) {
        if (entry.section.getBoundingClientRect().top <= marker) {
          current = entry;
        }
      }
      setActive(current.id);
    };

    if (typeof window.IntersectionObserver !== "function") {
      let scheduled = false;
      const onScroll = () => {
        if (scheduled) {
          return;
        }
        scheduled = true;
        window.requestAnimationFrame(() => {
          scheduled = false;
          updateFromScroll();
        });
      };
      updateFromScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return;
    }

    const visible = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target.id);
          } else {
            visible.delete(entry.target.id);
          }
        }

        const current = sections.find((entry) => visible.has(entry.id));
        if (current) {
          setActive(current.id);
        } else {
          updateFromScroll();
        }
      },
      { rootMargin: "-32% 0px -58% 0px", threshold: 0 },
    );

    for (const entry of sections) {
      observer.observe(entry.section);
    }

    const hash = window.location.hash.slice(1);
    setActive(hash && sections.some((entry) => entry.id === hash) ? hash : sections[0].id);
  }

  function initReveal() {
    const elements = Array.from(document.querySelectorAll("[data-reveal]"));
    if (elements.length === 0) {
      return;
    }

    for (const element of elements) {
      const delay = Number(element.getAttribute("data-reveal-delay"));
      if (Number.isFinite(delay) && delay > 0) {
        element.style.setProperty("--reveal-delay", `${delay}ms`);
      }
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || typeof window.IntersectionObserver !== "function") {
      for (const element of elements) {
        element.classList.add("is-visible");
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    for (const element of elements) {
      observer.observe(element);
    }
  }

  function initCopyButtons() {
    const buttons = Array.from(document.querySelectorAll("[data-copy-target]"));
    if (buttons.length === 0) {
      return;
    }

    const status = document.getElementById("copy-status");
    let resetTimer;

    for (const button of buttons) {
      button.addEventListener("click", async () => {
        const targetId = button.getAttribute("data-copy-target");
        const target = targetId ? document.getElementById(targetId) : null;
        const text = target?.textContent?.trim();
        if (!text) {
          announce(status, "Nothing to copy.");
          return;
        }

        const label = button.querySelector("span");
        const originalLabel = label?.textContent ?? "Copy";
        const copied = await copyText(text);

        if (copied) {
          button.classList.add("is-copied");
          if (label) {
            label.textContent = "Copied!";
          }
          announce(status, "Commands copied to the clipboard.");
        } else {
          announce(status, "Copy failed — select the commands manually.");
        }

        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(() => {
          button.classList.remove("is-copied");
          if (label) {
            label.textContent = originalLabel;
          }
          announce(status, "");
        }, 3000);
      });
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall through to the legacy path.
      }
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-1000px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }

  function announce(element, message) {
    if (element) {
      element.textContent = message;
    }
  }

  function initFooterYear() {
    const year = String(new Date().getFullYear());
    for (const element of document.querySelectorAll("[data-year]")) {
      element.textContent = year;
    }
  }
})();
