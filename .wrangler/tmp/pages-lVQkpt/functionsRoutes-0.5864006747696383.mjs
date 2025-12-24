import { onRequestDelete as __api_admin_users__id__ts_onRequestDelete } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\admin\\users\\[id].ts"
import { onRequestPatch as __api_admin_users__id__ts_onRequestPatch } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\admin\\users\\[id].ts"
import { onRequest as __api_admin_users__id__ts_onRequest } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\admin\\users\\[id].ts"
import { onRequestGet as __api_admin_users_ts_onRequestGet } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\admin\\users.ts"
import { onRequestPost as __api_admin_users_ts_onRequestPost } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\admin\\users.ts"
import { onRequestGet as __api_auth_login_ts_onRequestGet } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\auth\\login.ts"
import { onRequestPost as __api_auth_login_ts_onRequestPost } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\auth\\login.ts"
import { onRequestPost as __api_auth_logout_ts_onRequestPost } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\auth\\logout.ts"
import { onRequest as __api_admin_users_ts_onRequest } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\admin\\users.ts"
import { onRequest as __api_auth_login_ts_onRequest } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\auth\\login.ts"
import { onRequest as __api_auth_logout_ts_onRequest } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\auth\\logout.ts"
import { onRequestDelete as __api_notes__id__ts_onRequestDelete } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\notes\\[id].ts"
import { onRequestGet as __api_notes__id__ts_onRequestGet } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\notes\\[id].ts"
import { onRequestPut as __api_notes__id__ts_onRequestPut } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\notes\\[id].ts"
import { onRequest as __api_notes__id__ts_onRequest } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\notes\\[id].ts"
import { onRequestGet as __api_me_ts_onRequestGet } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\me.ts"
import { onRequestGet as __api_notes_ts_onRequestGet } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\notes.ts"
import { onRequestPost as __api_notes_ts_onRequestPost } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\notes.ts"
import { onRequest as __api_me_ts_onRequest } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\me.ts"
import { onRequest as __api_notes_ts_onRequest } from "E:\\下载\\memo-cloud-fixed3\\memo-cloud\\functions\\api\\notes.ts"

export const routes = [
    {
      routePath: "/api/admin/users/:id",
      mountPath: "/api/admin/users",
      method: "DELETE",
      middlewares: [],
      modules: [__api_admin_users__id__ts_onRequestDelete],
    },
  {
      routePath: "/api/admin/users/:id",
      mountPath: "/api/admin/users",
      method: "PATCH",
      middlewares: [],
      modules: [__api_admin_users__id__ts_onRequestPatch],
    },
  {
      routePath: "/api/admin/users/:id",
      mountPath: "/api/admin/users",
      method: "",
      middlewares: [],
      modules: [__api_admin_users__id__ts_onRequest],
    },
  {
      routePath: "/api/admin/users",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_users_ts_onRequestGet],
    },
  {
      routePath: "/api/admin/users",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_users_ts_onRequestPost],
    },
  {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_login_ts_onRequestGet],
    },
  {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_login_ts_onRequestPost],
    },
  {
      routePath: "/api/auth/logout",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_logout_ts_onRequestPost],
    },
  {
      routePath: "/api/admin/users",
      mountPath: "/api/admin",
      method: "",
      middlewares: [],
      modules: [__api_admin_users_ts_onRequest],
    },
  {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "",
      middlewares: [],
      modules: [__api_auth_login_ts_onRequest],
    },
  {
      routePath: "/api/auth/logout",
      mountPath: "/api/auth",
      method: "",
      middlewares: [],
      modules: [__api_auth_logout_ts_onRequest],
    },
  {
      routePath: "/api/notes/:id",
      mountPath: "/api/notes",
      method: "DELETE",
      middlewares: [],
      modules: [__api_notes__id__ts_onRequestDelete],
    },
  {
      routePath: "/api/notes/:id",
      mountPath: "/api/notes",
      method: "GET",
      middlewares: [],
      modules: [__api_notes__id__ts_onRequestGet],
    },
  {
      routePath: "/api/notes/:id",
      mountPath: "/api/notes",
      method: "PUT",
      middlewares: [],
      modules: [__api_notes__id__ts_onRequestPut],
    },
  {
      routePath: "/api/notes/:id",
      mountPath: "/api/notes",
      method: "",
      middlewares: [],
      modules: [__api_notes__id__ts_onRequest],
    },
  {
      routePath: "/api/me",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_me_ts_onRequestGet],
    },
  {
      routePath: "/api/notes",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_notes_ts_onRequestGet],
    },
  {
      routePath: "/api/notes",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_notes_ts_onRequestPost],
    },
  {
      routePath: "/api/me",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_me_ts_onRequest],
    },
  {
      routePath: "/api/notes",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_notes_ts_onRequest],
    },
  ]