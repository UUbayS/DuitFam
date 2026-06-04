<?php

use App\Http\Controllers\Api\AiChatController;
use App\Http\Controllers\Api\ApprovalController;
use App\Http\Controllers\Api\SpendingTipsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\RecurringTransactionController;
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
    Route::post("/auth/generate-invite", [AuthController::class, "generateInvite"])->middleware('throttle:generate-invite');
    Route::get("/auth/parent-status", [AuthController::class, "parentStatus"]);

    Route::post("/transactions", [TransactionController::class, "store"]);
    Route::post("/transactions/bulk-cancel", [
        TransactionController::class,
        "bulkCancel",
    ]);
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
    Route::get("/transactions/{id}", [TransactionController::class, "show"]);
    Route::put("/transactions/{id}", [TransactionController::class, "update"]);
    Route::delete("/transactions/{id}", [TransactionController::class, "destroy"]);

    Route::get("/targets", [TargetController::class, "index"]);
    Route::post("/targets", [TargetController::class, "store"]);
    Route::put("/targets/{id}", [TargetController::class, "update"]);
    Route::delete("/targets/{id}", [TargetController::class, "destroy"]);
    Route::post("/targets/contribute", [TargetController::class, "contribute"]);
    Route::post("/targets/withdraw", [TargetController::class, "withdraw"]);

    Route::put("/users/profile", [UserController::class, "updateProfile"]);
    Route::put("/users/password", [UserController::class, "updatePassword"]);
    Route::post("/users/children", [UserController::class, "linkChild"]);
    Route::post("/users/children/link", [UserController::class, "linkChildByCode"]);
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
    Route::delete("/users/children/{id}", [
        UserController::class,
        "deleteChild",
    ]);
    Route::get("/users/children/balances", [
        UserController::class,
        "childrenBalances",
    ]);

    Route::get("/utilities/categories", [
        UtilityController::class,
        "categories",
    ]);

    Route::get("/budgets", [BudgetController::class, "index"]);
    Route::post("/budgets", [BudgetController::class, "store"]);
    Route::put("/budgets/{id}", [BudgetController::class, "update"]);
    Route::delete("/budgets/{id}", [BudgetController::class, "destroy"]);
    Route::get("/budgets/summary", [BudgetController::class, "summary"]);

    Route::get("/recurring-transactions", [RecurringTransactionController::class, "index"]);
    Route::post("/recurring-transactions", [RecurringTransactionController::class, "store"]);
    Route::put("/recurring-transactions/{id}", [RecurringTransactionController::class, "update"]);
    Route::delete("/recurring-transactions/{id}", [RecurringTransactionController::class, "destroy"]);
    Route::post("/recurring-transactions/generate-all", [RecurringTransactionController::class, "generateAll"]);
    Route::post("/recurring-transactions/{id}/generate", [RecurringTransactionController::class, "generate"]);

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
    Route::get("/reports/family/analysis/pdf", [
        ReportController::class,
        "familyAnalysisPdf",
    ]);

    Route::get("/reports/export", [ReportController::class, "export"]);

    Route::get("/notifications", [NotificationController::class, "index"]);
    Route::patch("/notifications/{id}/read", [
        NotificationController::class,
        "markRead",
    ]);

    // AI Chat & Alerts
    Route::post("/ai/chat", [AiChatController::class, "chat"]);
    Route::get("/ai/alerts", [AiChatController::class, "getAlerts"]);
    Route::get("/ai/spending-tips", [SpendingTipsController::class, "index"]);
});
