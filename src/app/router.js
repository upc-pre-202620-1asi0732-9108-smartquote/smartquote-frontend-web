import { createRouter, createWebHashHistory } from "vue-router";
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/requests" },
    {
      path: "/requests",
      component: () =>
        import("../supply-requests/presentation/pages/request-list.vue"),
    },
    {
      path: "/requests/new",
      meta: { roles: ["ProductionSpecialist"] },
      component: () =>
        import("../supply-requests/presentation/pages/request-form.vue"),
    },
    {
      path: "/requests/:id",
      component: () =>
        import("../supply-requests/presentation/pages/request-detail.vue"),
    },
    {
      path: "/notifications",
      meta: { roles: ["ProductionSpecialist"] },
      component: () =>
        import("../supply-requests/presentation/pages/notification-list.vue"),
    },
    {
      path: "/registrations",
      meta: { roles: ["PurchaseManager"] },
      component: () =>
        import("../identity/presentation/pending-registrations-page.vue"),
    },
    {
      path: "/suppliers",
      meta: { roles: ["PurchaseAnalyst", "PurchaseManager"] },
      component: () =>
        import("../supplier-performance/presentation/supplier-performance-page.vue"),
    },
    {
      path: "/metrics",
      meta: { roles: ["PurchaseManager"] },
      component: () =>
        import("../purchase-ordering/presentation/metrics-page.vue"),
    },
    { path: "/:pathMatch(.*)*", redirect: "/requests" },
  ],
});
