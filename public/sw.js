
const APP_BASE_PATH = "/social-monitor/";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
    })()
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};

      if (event.data) {
        try {
          payload = event.data.json();
        } catch {
          payload = {
            body: event.data.text()
          };
        }
      }

      const title =
        typeof payload.title === "string" && payload.title.trim()
          ? payload.title
          : "Social Monitor";

      const options = {
        body:
          typeof payload.body === "string" && payload.body.trim()
            ? payload.body
            : "لديك إشعار جديد.",
        icon: payload.icon || undefined,
        badge: payload.badge || undefined,
        tag: payload.tag || undefined,
        renotify: Boolean(payload.renotify),
        data: {
          url: payload.url || APP_BASE_PATH
        },
        dir: "rtl",
        lang: "ar",
        timestamp: Date.now()
      };

      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const targetUrl = new URL(
        event.notification.data?.url || APP_BASE_PATH,
        self.location.origin
      );

      // منع فتح روابط خارج الموقع.
      if (
        targetUrl.origin !== self.location.origin ||
        !targetUrl.pathname.startsWith(APP_BASE_PATH)
      ) {
        targetUrl.href = new URL(
          APP_BASE_PATH,
          self.location.origin
        ).href;
      }

      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      for (const client of windows) {
        if (client.url.startsWith(self.location.origin)) {
          await client.navigate(targetUrl.href);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl.href);
    })()
  );
});
