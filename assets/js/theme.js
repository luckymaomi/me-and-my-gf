(function () {
    "use strict";

    var storageKey = "me-and-my-gf.theme";
    var legacyStorageKeys = ["21.theme", "lifein21.theme"];
    var themeEvent = "me-and-my-gf:themechange";
    var defaultTheme = document.documentElement.dataset.defaultTheme === "dark" ? "dark" : "light";
    function normalizeTheme(value) {
        return value === "dark" || value === "light" ? value : defaultTheme;
    }

    function readStoredTheme() {
        try {
            var stored = window.localStorage.getItem(storageKey);
            if (stored == null) {
                for (var i = 0; i < legacyStorageKeys.length; i += 1) {
                    stored = window.localStorage.getItem(legacyStorageKeys[i]);
                    if (stored != null) {
                        window.localStorage.setItem(storageKey, stored);
                        break;
                    }
                }
            }
            return normalizeTheme(stored);
        } catch (error) {
            return defaultTheme;
        }
    }

    function storeTheme(theme) {
        try {
            window.localStorage.setItem(storageKey, theme);
        } catch (error) {
            return;
        }
    }

    function applyTheme(theme, shouldStore) {
        var nextTheme = normalizeTheme(theme);
        var bootstrapTheme = nextTheme;
        var root = document.documentElement;

        root.dataset.theme = nextTheme;
        root.dataset.bsTheme = bootstrapTheme;
        root.style.colorScheme = bootstrapTheme;

        if (document.body) {
            document.body.dataset.theme = nextTheme;
        }

        if (shouldStore) {
            storeTheme(nextTheme);
        }

        window.dispatchEvent(new CustomEvent(themeEvent, {
            detail: { theme: nextTheme }
        }));

        return nextTheme;
    }

    function getTheme() {
        return normalizeTheme(document.documentElement.dataset.theme || readStoredTheme());
    }

    function setTheme(theme) {
        return applyTheme(theme, true);
    }

    function toggleTheme() {
        return setTheme(getTheme() === "dark" ? "light" : "dark");
    }

    window.ThemeController = {
        getTheme: getTheme,
        setTheme: setTheme,
        toggleTheme: toggleTheme,
        storageKey: storageKey
    };

    applyTheme(readStoredTheme(), false);

    document.addEventListener("DOMContentLoaded", function () {
        applyTheme(getTheme(), false);
    });
}());
