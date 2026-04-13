<?php

use App\Http\Controllers\Api\AiChatController;
use App\Http\Controllers\Api\ApprovalController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\TargetController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UtilityController;
use Illuminate\Support\Facades\Route;

Route::prefix("auth")->group(function () {
    Route::post("/register", [AuthController::class, "register"]);
    Route::post("/login", [AuthController::class, "login"]);
});

Route::middleware("auth.token")->group(function () {
    Route::post("/auth/logout", [AuthController::class, "logout"]);

    Route::post("/transactions", [TransactionController::class, "store"]);
    Route::post("/transactions/deposit", [
        TransactionController::class,
        "deposit",
    ]);
    Route::post("/transactions/withdrawals", [
        ApprovalController::class,
        "store",
    ]);
    Route::get("/transactions/withdrawals", [
        ApprovalController::class,
        "index",
    ]);
    Route::patch("/transactions/withdrawals/{id}", [
        ApprovalController::class,
        "action",
    ]);

    Route::get("/targets", [TargetController::class, "index"]);
    Route::post("/targets", [TargetController::class, "store"]);
    Route::put("/targets/{id}", [TargetController::class, "update"]);
    Route::delete("/targets/{id}", [TargetController::class, "destroy"]);
    Route::post("/targets/contribute", [TargetController::class, "contribute"]);

    Route::put("/users/profile", [UserController::class, "updateProfile"]);
    Route::put("/users/password", [UserController::class, "updatePassword"]);
    Route::post("/users/children", [UserController::class, "linkChild"]);
    Route::post("/users/children/create", [
        UserController::class,
        "createChild",
    ]);
    Route::put("/users/children/{id}", [UserController::class, "updateChild"]);
    Route::patch("/users/children/{id}/toggle", [
        UserController::class,
        "toggleChild",
    ]);
    Route::get("/users/children", [UserController::class, "children"]);
    Route::get("/users/children/balances", [
        UserController::class,
        "childrenBalances",
    ]);

    Route::get("/utilities/categories", [
        UtilityController::class,
        "categories",
    ]);

    Route::get("/reports/summary", [ReportController::class, "summary"]);
    Route::get("/reports/history", [ReportController::class, "history"]);
    Route::get("/reports/analysis", [ReportController::class, "analysis"]);
    Route::get("/reports/historical", [ReportController::class, "historical"]);
    Route::get("/reports/family/summary", [
        ReportController::class,
        "familySummary",
    ]);
    Route::get("/reports/family/history", [
        ReportController::class,
        "familyHistory",
    ]);
    Route::get("/reports/family/historical", [
        ReportController::class,
        "familyHistorical",
    ]);
    Route::get("/reports/family/analysis", [
        ReportController::class,
        "familyAnalysis",
    ]);

    Route::get("/notifications", [NotificationController::class, "index"]);
    Route::patch("/notifications/{id}/read", [
        NotificationController::class,
        "markRead",
    ]);

    // AI Chat & Alerts
    Route::post("/ai/chat", [AiChatController::class, "chat"]);
    Route::get("/ai/alerts", [AiChatController::class, "getAlerts"]);
});
