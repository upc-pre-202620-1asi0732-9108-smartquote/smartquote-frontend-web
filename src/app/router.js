import { createRouter, createWebHashHistory } from "vue-router";
import SaasAgreement from "../shared/presentation/components/saas-agreement.vue";
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/requests" },
    { path: "/acuerdo-saas", component: SaasAgreement },
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
      path: "/requests/:id/edit",
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
      path: "/recurring-requests",
      meta: { roles: ["ProductionSpecialist"] },
      component: () =>
        import("../supply-requests/presentation/pages/recurring-schedules.vue"),
    },
    {
      path: "/clarifications",
      meta: { roles: ["ProductionSpecialist"] },
      component: () =>
        import("../supply-requests/presentation/pages/clarification-inbox.vue"),
    },
    {
      path: "/expiry-alerts",
      meta: { roles: ["PurchaseAnalyst"] },
      component: () =>
        import("../quotation-intake/presentation/expiry-alert-list.vue"),
    },
    {
      path: "/supplier-eligibility",
      meta: { roles: ["PurchaseAnalyst", "PurchaseManager"] },
      component: () =>
        import("../purchase-ordering/presentation/supplier-eligibility-page.vue"),
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
        import("../purchase-ordering/presentation/supplier-performance-page.vue"),
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
