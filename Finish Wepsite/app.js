(() => {
  "use strict";

  const isArabic = () => document.documentElement.lang === "ar";
  const localizedText = (arabic, english) => (isArabic() ? arabic : english);

  // تهيئة السنة الحالية وقائمة التنقل على الهاتف
  const currentYear = document.getElementById("currentYear");
  if (currentYear) currentYear.textContent = String(new Date().getFullYear());

  const menuToggle = document.getElementById("menuToggle");
  const primaryNav = document.getElementById("primaryNav");
  if (menuToggle && primaryNav) {
    menuToggle.addEventListener("click", () => {
      const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!isExpanded));
      primaryNav.classList.toggle("is-open", !isExpanded);
    });
    primaryNav.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement) {
        primaryNav.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // توحيد النص العربي والإنجليزي قبل المقارنة في البحث
  const normalize = (value) =>
    value
      .toLocaleLowerCase("ar")
      .normalize("NFD")
      .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .trim();

  // البحث العام وبناء نتائج مرتبطة بأقسام المحتوى
  const searchForm = document.getElementById("globalSearchForm");
  const globalSearch = document.getElementById("globalSearch");
  const searchResults = document.getElementById("searchResults");

  const getSearchableItems = () =>
    Array.from(document.querySelectorAll("main section[id]"))
      .filter((section) => section.id !== "home")
      .flatMap((section) => {
        const sectionTitle =
          section.querySelector(".section-heading h2")?.textContent?.trim() ||
          localizedText("موضوع", "Topic");
        const sectionDescription =
          section.querySelector(".section-heading > p")?.textContent?.trim() || "";
        let cardIndex = 0;
        const items = [{
          id: section.id,
          title: sectionTitle,
          body: sectionDescription || sectionTitle,
          keywords: "",
          sectionTitle,
        }];

        section.querySelectorAll("article, .callout, .urgent-panel").forEach((card) => {
          cardIndex += 1;
          if (!card.id) card.id = `${section.id}-search-${cardIndex}`;
          const title =
            card.querySelector("h3, h4, strong")?.textContent?.trim() || sectionTitle;
          const body = Array.from(card.querySelectorAll("p, li, summary"))
            .map((element) => element.textContent.trim())
            .filter(Boolean)
            .join(" ");
          items.push({
            id: card.id,
            title,
            body,
            keywords: card.getAttribute("data-search") || "",
            sectionTitle,
          });
        });
        return items;
      });

  const makeSnippet = (text, terms) => {
    const normalizedText = normalize(text);
    const matchIndexes = terms
      .map((term) => normalizedText.indexOf(term))
      .filter((index) => index >= 0);
    if (!matchIndexes.length) {
      return text.slice(0, 170).trim();
    }

    const matchIndex = Math.min(...matchIndexes);
    let start = Math.max(0, matchIndex - 58);
    if (start > 0) {
      const wordStart = text.indexOf(" ", start);
      if (wordStart >= 0 && wordStart < matchIndex) start = wordStart + 1;
    }
    let end = Math.min(text.length, start + 180);
    if (end < text.length) {
      const wordEnd = text.lastIndexOf(" ", end);
      if (wordEnd > matchIndex) end = wordEnd;
    }
    return `${start > 0 ? "… " : ""}${text.slice(start, end).trim()}${end < text.length ? " …" : ""}`;
  };

  const appendHighlightedText = (element, text, terms) => {
    const pattern = terms
      .filter(Boolean)
      .sort((first, second) => second.length - first.length)
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    if (!pattern) {
      element.textContent = text;
      return;
    }

    const matcher = new RegExp(`(${pattern})`, "gi");
    let lastIndex = 0;
    let match;
    while ((match = matcher.exec(text)) !== null) {
      element.append(document.createTextNode(text.slice(lastIndex, match.index)));
      const highlight = document.createElement("mark");
      highlight.textContent = match[0];
      element.append(highlight);
      lastIndex = matcher.lastIndex;
    }
    element.append(document.createTextNode(text.slice(lastIndex)));
  };

  const renderGlobalSearch = () => {
    if (!(globalSearch instanceof HTMLInputElement) || !searchResults) return;
    const query = normalize(globalSearch.value);
    searchResults.replaceChildren();
    searchResults.classList.remove("has-results");
    if (!query) {
      searchResults.hidden = true;
      return;
    }

    const terms = query.split(/\s+/).filter(Boolean);
    const matches = getSearchableItems()
      .map((item) => {
        const titleText = normalize(item.title);
        const bodyText = normalize(item.body);
        const keywordsText = normalize(item.keywords);
        const searchableText = `${titleText} ${bodyText} ${keywordsText}`;
        if (!terms.every((term) => searchableText.includes(term))) return null;

        const score = terms.reduce((total, term) => {
          if (titleText.includes(term)) return total + 8;
          if (bodyText.includes(term)) return total + 3;
          return total + 1;
        }, 0);
        return { ...item, score, snippet: makeSnippet(item.body, terms) };
      })
      .filter((item) => item !== null)
      .sort((first, second) => second.score - first.score);

    const heading = document.createElement("div");
    heading.className = "search-results-header";
    const headingText = document.createElement("strong");
    headingText.className = "search-result-heading";
    headingText.textContent = matches.length
      ? localizedText(
          `${matches.length} نتيجة مرتبطة ببحثك`,
          `${matches.length} relevant results`,
        )
      : localizedText("لا توجد نتائج مطابقة", "No matching results");
    heading.append(headingText);

    if (matches.length) {
      searchResults.classList.add("has-results");
      const helper = document.createElement("span");
      helper.className = "search-results-hint";
      helper.textContent = localizedText(
        "مرتبة حسب صلة الموضوع بعبارة البحث",
        "Ranked by relevance to your search",
      );
      heading.append(helper);
      searchResults.append(heading);

      const list = document.createElement("ol");
      list.className = "search-result-list";
      const appendResult = (target, match) => {
        const result = document.createElement("li");
        const link = document.createElement("a");
        link.className = "search-result-card";
        link.href = `#${match.id}`;
        const sectionLabel = document.createElement("span");
        sectionLabel.className = "search-result-section";
        sectionLabel.textContent = match.sectionTitle;
        const title = document.createElement("strong");
        title.className = "search-result-title";
        appendHighlightedText(title, match.title, terms);
        const excerpt = document.createElement("p");
        excerpt.className = "search-result-excerpt";
        appendHighlightedText(excerpt, match.snippet, terms);
        const action = document.createElement("span");
        action.className = "search-result-action";
        action.textContent = localizedText("انتقل إلى القسم ←", "View section →");
        link.append(sectionLabel, title, excerpt, action);
        result.append(link);
        target.append(result);
      };

      matches.slice(0, 6).forEach((match) => appendResult(list, match));
      searchResults.append(list);
      if (matches.length > 6) {
        const moreResults = document.createElement("details");
        moreResults.className = "search-more-results";
        const summary = document.createElement("summary");
        summary.textContent = localizedText(
          `عرض ${matches.length - 6} نتائج إضافية`,
          `Show ${matches.length - 6} more results`,
        );
        const remainingList = document.createElement("ol");
        remainingList.className = "search-result-list";
        remainingList.start = 7;
        matches.slice(6).forEach((match) => appendResult(remainingList, match));
        moreResults.append(summary, remainingList);
        searchResults.append(moreResults);
      }
    } else {
      const helper = document.createElement("p");
      helper.className = "search-no-results";
      helper.textContent = localizedText(
        "جرّب كلمة أبسط أو اختر أحد الموضوعات المقترحة أسفل مربع البحث.",
        "Try a simpler term or choose one of the suggested topics below the search box.",
      );
      heading.append(helper);
      searchResults.append(heading);
    }
    searchResults.hidden = false;
  };

  if (searchForm && globalSearch) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      renderGlobalSearch();
      if (searchResults && !searchResults.hidden) {
        searchResults.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
    globalSearch.addEventListener("input", renderGlobalSearch);
  }

  // تعبئة البحث من الكلمات المقترحة
  document.querySelectorAll("[data-search-query]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!(globalSearch instanceof HTMLInputElement)) return;
      globalSearch.value = button.getAttribute("data-search-query") || "";
      globalSearch.dispatchEvent(new Event("input", { bubbles: true }));
      globalSearch.focus();
    });
  });

  // تحديث المحتوى التفاعلي بعد تغيير لغة الموقع
  window.addEventListener("languagechange", () => {
    if (globalSearch?.value) renderGlobalSearch();
    if (carePlanMessage) carePlanMessage.textContent = "";
    if (caseStage && !caseStage.hidden) renderCaseStage();
    if (caseFeedback) caseFeedback.textContent = "";
  });

  // تصفية البطاقات الدوائية حسب النص والكلمات المفتاحية
  const medicationSearch = document.getElementById("medicationSearch");
  const medicationCards = Array.from(
    document.querySelectorAll(".medication-card"),
  );
  const medicationEmpty = document.getElementById("medicationEmpty");
  medicationSearch?.addEventListener("input", () => {
    const query = normalize(medicationSearch.value);
    let visible = 0;
    medicationCards.forEach((card) => {
      const searchable = normalize(
        `${card.textContent} ${card.getAttribute("data-search") || ""}`,
      );
      const isVisible = !query || searchable.includes(query);
      card.hidden = !isVisible;
      if (isVisible) visible += 1;
    });
    if (medicationEmpty) medicationEmpty.hidden = visible > 0;
  });

  // البحث في المكتبة مع التصفية حسب النوع والسنة والموضوع
  const librarySearch = document.getElementById("librarySearch");
  const libraryType = document.getElementById("libraryType");
  const libraryYear = document.getElementById("libraryYear");
  const libraryTopic = document.getElementById("libraryTopic");
  const libraryEntries = Array.from(
    document.querySelectorAll("#libraryEntries .resource-card"),
  );
  const filterLibrary = () => {
    const query = normalize(librarySearch?.value || "");
    const type = libraryType?.value || "all";
    const year = libraryYear?.value || "all";
    const topic = libraryTopic?.value || "all";
    libraryEntries.forEach((entry) => {
      const matchesText = normalize(
        `${entry.textContent} ${entry.getAttribute("data-search") || ""}`,
      ).includes(query);
      const matchesType =
        type === "all" || entry.getAttribute("data-type") === type;
      const matchesYear =
        year === "all" || entry.getAttribute("data-year") === year;
      const matchesTopic =
        topic === "all" || entry.getAttribute("data-topic") === topic;
      entry.hidden = !(matchesText && matchesType && matchesYear && matchesTopic);
    });
  };
  librarySearch?.addEventListener("input", filterLibrary);
  libraryType?.addEventListener("change", filterLibrary);
  libraryYear?.addEventListener("change", filterLibrary);
  libraryTopic?.addEventListener("change", filterLibrary);

  // التحقق من قالب الرعاية وتجهيزه للطباعة دون حفظ البيانات
  const carePlanForm = document.getElementById("carePlanForm");
  const carePlanMessage = document.getElementById("carePlanMessage");
  carePlanForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!(carePlanForm instanceof HTMLFormElement) || !carePlanForm.reportValidity()) {
      return;
    }
    if (carePlanMessage) {
      carePlanMessage.textContent = localizedText(
        "اكتمل النموذج. لا تُحفظ المعلومات؛ اطبع النسخة محليًا إذا رغبت.",
        "The form is complete. Information is not saved; print a local copy if you wish.",
      );
    }
  });

  document.getElementById("printCarePlan")?.addEventListener("click", () => {
    window.print();
  });

  // إدارة مراحل الحالة التعليمية وإجاباتها
  const caseStage = document.getElementById("caseStage");
  const caseQuestion = document.getElementById("caseQuestion");
  const caseFeedback = document.getElementById("caseFeedback");
  let caseRevealed = false;
  function renderCaseStage() {
    if (!caseStage) return;
    caseStage.innerHTML = caseRevealed
      ? localizedText(
          '<h3>المرحلة ٢: معلومات إضافية</h3><p>في هذه المحاكاة، يذكر الشخص أيضًا تيبّسًا في الحركة. ما زالت هناك حاجة لتاريخ مرضي وفحص ومراجعة الأدوية والبدائل قبل أي استنتاج.</p><button class="button button-primary" id="caseNext" type="button">انتقل إلى سؤال التفكير السريري</button>',
          '<h3>Stage 2: More information</h3><p>In this simulation, the person also reports stiffness. A medical history, examination, and review of medicines and alternatives are still needed before drawing conclusions.</p><button class="button button-primary" id="caseNext" type="button">Continue to the clinical reasoning question</button>',
        )
      : localizedText(
          "<h3>المرحلة ١: العرض الأولي</h3><p>شخص افتراضي يراجع بسبب بطء متزايد في أداء بعض المهام اليومية. لا تكفي هذه المعلومة وحدها لتحديد سبب الأعراض.</p><button class=\"button button-primary\" id=\"caseNext\" type=\"button\">اكشف مزيدًا من المعلومات</button>",
          "<h3>Stage 1: Initial presentation</h3><p>A fictional person seeks advice about increasing slowness when performing some daily tasks. This information alone is not enough to determine the cause.</p><button class=\"button button-primary\" id=\"caseNext\" type=\"button\">Reveal more information</button>",
        );
  }
  caseStage?.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement) || event.target.id !== "caseNext") {
      return;
    }
    if (!caseRevealed) {
      caseRevealed = true;
      renderCaseStage();
    } else {
      caseStage.hidden = true;
      if (caseQuestion) caseQuestion.hidden = false;
      caseQuestion?.querySelector("input")?.focus();
    }
  });

  document.getElementById("caseSubmit")?.addEventListener("click", () => {
    const answer = document.querySelector(
      'input[name="caseAnswer"]:checked',
    );
    if (!(answer instanceof HTMLInputElement)) {
      if (caseFeedback) {
        caseFeedback.textContent = localizedText(
          "اختر إجابة قبل عرض التغذية الراجعة.",
          "Choose an answer before viewing the feedback.",
        );
      }
      return;
    }
    const isCorrect = answer.value === "b";
    if (caseFeedback) {
      caseFeedback.textContent = isCorrect
        ? localizedText(
            "إجابة مناسبة للمحاكاة: استكمل التاريخ والفحص ومراجعة الأدوية والبدائل. لا تثبت التشخيص من عرض منفرد.",
            "A suitable answer for this simulation: complete the history, examination, and review of medicines and alternatives. Do not confirm a diagnosis from a single symptom.",
          )
        : localizedText(
            "هذه الإجابة تقفز إلى استنتاج أو تدخل دون تقييم. الأفضل استكمال التاريخ والفحص ومراجعة الأدوية والبدائل مع مختص.",
            "This answer jumps to a conclusion or intervention without assessment. It is better to complete the history, examination, and review of medicines and alternatives with a specialist.",
          );
    }
  });

  document.getElementById("caseReset")?.addEventListener("click", () => {
    caseRevealed = false;
    if (caseStage) {
      caseStage.hidden = false;
      renderCaseStage();
    }
    if (caseQuestion) caseQuestion.hidden = true;
    if (caseFeedback) caseFeedback.textContent = "";
    document
      .querySelectorAll('input[name="caseAnswer"]')
      .forEach((input) => {
        if (input instanceof HTMLInputElement) input.checked = false;
      });
  });

  // طباعة ورقة المريض المحددة فقط
  document.querySelectorAll(".leaflet-print").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".leaflet-card");
      if (!card) return;
      document.body.classList.add("print-leaflet");
      card.classList.add("print-selected");
      const cleanUp = () => {
        document.body.classList.remove("print-leaflet");
        card.classList.remove("print-selected");
        window.removeEventListener("afterprint", cleanUp);
      };
      window.addEventListener("afterprint", cleanUp);
      window.print();
    });
  });

  // إظهار القسم الحالي في شريط التنقل
  const navLinks = Array.from(
    document.querySelectorAll('.primary-nav a[href^="#"]'),
  );
  if ("IntersectionObserver" in window && navLinks.length) {
    const targets = navLinks
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter((target) => target instanceof HTMLElement);
    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
        if (!active) return;
        navLinks.forEach((link) => {
          const isCurrent = link.hash === `#${active.target.id}`;
          if (isCurrent) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      },
      { rootMargin: "-22% 0px -68% 0px", threshold: [0, 0.2, 0.5] },
    );
    targets.forEach((target) => observer.observe(target));
  }
})();
