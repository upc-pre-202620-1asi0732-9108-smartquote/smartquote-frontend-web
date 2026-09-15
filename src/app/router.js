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
    { path: "/:pathMatch(.*)*", redirect: "/requests" },
  ],
});
