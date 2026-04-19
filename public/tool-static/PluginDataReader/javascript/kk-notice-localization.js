(function () {
  const LANG_STORAGE_KEY = "kk_pdr_notice_lang";
  const HOME_HREF = "/";
  const HOME_TEXTS = new Set(["首页", "首頁", "home", "Home"]);

  const i18n = {
    zhCN: {
      switchLabel: "语言",
      noticeTitle: "※注意※",
      sections: [
        {
          title: "Q: 服务器会使用我的人物卡?",
          lines: [
            "本工具使用Blazor wasm技术实作，完全在浏览器内执行C#计算",
            "不会将任何使用者资料传回服务器",
            "不会取得任何存档",
            "此页面在Github上开源，本工具由Mmc1xs在koikatsucard.com的网域中运行，由jim60105开发"
          ]
        },
        {
          title: "Q: 我被提示要安套件",
          lines: [
            "此专案建置为「渐进式网络应用程式(PWA)」，能够被安装至系统中离线使用",
            "请参考 Wiki 和 MDN 以获得更多资讯",
            "简而言之，此工具能同时以网页或安装为桌面应用的型式使用",
            "如果你没有看到相关提示，请以Chromium based浏览器开启本页面"
          ]
        }
      ]
    },
    en: {
      switchLabel: "Language",
      noticeTitle: "Notice",
      sections: [
        {
          title: "Q: Will the server use my character card?",
          lines: [
            "This tool is built with Blazor wasm and runs C# fully inside your browser.",
            "No user data is sent back to the server.",
            "No save file is collected.",
            "This page is open-source on GitHub. The tool runs on koikatsucard.com by Mmc1xs and was developed by jim60105."
          ]
        },
        {
          title: "Q: I was prompted to install a package",
          lines: [
            "This project is built as a Progressive Web App (PWA), so it can be installed for offline use.",
            "Please refer to the Wiki and MDN for more information.",
            "In short, this tool can be used both as a webpage and as an installed desktop-style app.",
            "If you do not see the prompt, please open this page with a Chromium-based browser."
          ]
        }
      ]
    },
    ja: {
      switchLabel: "言語",
      noticeTitle: "注意",
      sections: [
        {
          title: "Q: サーバーは私のキャラカードを使用しますか？",
          lines: [
            "このツールはBlazor wasmで実装され、C#の処理はブラウザー内で完結します。",
            "ユーザーデータをサーバーへ送信することはありません。",
            "セーブデータを取得することはありません。",
            "このページはGitHubで公開され、ツールはMmc1xsがkoikatsucard.comドメインで運用し、jim60105が開発しました。"
          ]
        },
        {
          title: "Q: インストールの案内が表示されました",
          lines: [
            "このプロジェクトはPWA（Progressive Web App）として構築され、システムへインストールしてオフライン利用できます。",
            "詳しくはWikiとMDNをご確認ください。",
            "つまり、このツールはWebページとしても、インストール型デスクトップアプリ風としても利用できます。",
            "表示されない場合はChromiumベースのブラウザーでこのページを開いてください。"
          ]
        }
      ]
    }
  };

  function patchHomeLink() {
    const navLinks = Array.from(document.querySelectorAll("header a, .nav-masthead a"));
    if (!navLinks.length) {
      return false;
    }

    let patched = false;
    navLinks.forEach(function (link, index) {
      const text = (link.textContent || "").trim();
      if (index === 0 || HOME_TEXTS.has(text)) {
        link.setAttribute("href", HOME_HREF);
        patched = true;
      }
    });
    return patched;
  }

  function findNoticePanel() {
    const panels = Array.from(document.querySelectorAll("div.d-flex.flex-column.overflow-auto"));
    for (const panel of panels) {
      const text = (panel.textContent || "").trim();
      if (text.includes("Q:") || panel.dataset.kkNoticePanel === "1") {
        return panel;
      }
    }
    return null;
  }

  function findNoticeTitleElement(panel) {
    const container = panel.parentElement;
    if (!container) {
      return null;
    }

    return container.querySelector("h5, h4, strong");
  }

  function renderNoticeHtml(lang) {
    const data = i18n[lang] || i18n.zhCN;
    return data.sections
      .map(function (section) {
        const lines = section.lines
          .map(function (line) {
            return '<p style="margin:0 0 6px 0;line-height:1.55;">' + line + "</p>";
          })
          .join("");

        return [
          '<section style="padding:0 0 16px 0;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:16px;">',
          '<h4 style="margin:0 0 10px 0;">' + section.title + "</h4>",
          lines,
          "</section>"
        ].join("");
      })
      .join("");
  }

  function getSavedLang() {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "zhCN" || saved === "en" || saved === "ja") {
      return saved;
    }
    return "zhCN";
  }

  function setSavedLang(lang) {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  }

  function ensureSwitcher(panel, activeLang, onSelect) {
    let wrap = document.getElementById("kk-notice-lang-switch");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "kk-notice-lang-switch";
      wrap.style.display = "flex";
      wrap.style.alignItems = "center";
      wrap.style.gap = "8px";
      wrap.style.marginBottom = "14px";

      const label = document.createElement("span");
      label.setAttribute("data-label", "1");
      label.style.fontSize = "12px";
      label.style.opacity = "0.9";
      wrap.appendChild(label);

      const items = [
        { key: "zhCN", label: "简体" },
        { key: "en", label: "EN" },
        { key: "ja", label: "JP" }
      ];

      items.forEach(function (item) {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("data-lang", item.key);
        button.textContent = item.label;
        button.style.padding = "4px 10px";
        button.style.borderRadius = "999px";
        button.style.fontSize = "12px";
        button.style.lineHeight = "1";
        button.style.cursor = "pointer";
        button.style.background = "rgba(255,255,255,.08)";
        button.style.color = "inherit";
        button.style.border = "1px solid rgba(255,255,255,.28)";
        button.addEventListener("click", function () {
          onSelect(item.key);
        });
        wrap.appendChild(button);
      });

      panel.prepend(wrap);
    }

    const label = wrap.querySelector("[data-label]");
    if (label) {
      label.textContent = (i18n[activeLang] || i18n.zhCN).switchLabel + ":";
    }

    Array.from(wrap.querySelectorAll("button[data-lang]")).forEach(function (button) {
      const isActive = button.getAttribute("data-lang") === activeLang;
      button.style.opacity = isActive ? "1" : "0.7";
      button.style.borderColor = isActive ? "#8fb8ff" : "rgba(255,255,255,.28)";
    });
  }

  function applyNoticeLanguage(lang) {
    const panel = findNoticePanel();
    if (!panel) {
      return false;
    }

    panel.dataset.kkNoticePanel = "1";
    panel.innerHTML = renderNoticeHtml(lang);

    const title = findNoticeTitleElement(panel);
    if (title) {
      title.textContent = (i18n[lang] || i18n.zhCN).noticeTitle;
    }

    ensureSwitcher(panel, lang, function (selectedLang) {
      setSavedLang(selectedLang);
      applyNoticeLanguage(selectedLang);
    });
    return true;
  }

  function retryPatchHomeLink() {
    let tries = 0;
    function run() {
      const patched = patchHomeLink();
      if (!patched && tries < 20) {
        tries += 1;
        window.setTimeout(run, 300);
      }
    }
    run();
  }

  function init() {
    retryPatchHomeLink();

    const lang = getSavedLang();
    let tries = 0;
    function apply() {
      const ok = applyNoticeLanguage(lang);
      if (!ok && tries < 40) {
        tries += 1;
        window.setTimeout(apply, 250);
      }
    }
    apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
