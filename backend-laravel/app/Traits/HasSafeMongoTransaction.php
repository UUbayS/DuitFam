<?php

namespace App\Traits;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

trait HasSafeMongoTransaction
{
    /**
     * Run a callback within a MongoDB transaction if supported, otherwise run it normally.
     *
     * @param callable $callback
     * @param string $connection
     * @return mixed
     * @throws \Exception
     */
    protected function safeMongoTransaction(callable $callback, string $connection = 'mongodb')
    {
        $db = DB::connection($connection);
        
        try {
            // Attempt to start a transaction
            $db->beginTransaction();
            $result = $callback();
            $db->commit();
            return $result;
        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            
            // Log the error for diagnosis
            Log::debug('Transaction error encountered', ['message' => $msg, 'class' => get_class($e)]);

            // Check if this is a known MongoDB standalone limitation error
            if (stripos($msg, 'replica set') !== false || 
                stripos($msg, 'Transaction numbers') !== false ||
                stripos($msg, 'sessions are not supported') !== false ||
                stripos($msg, 'multi-document transaction') !== false) {
                
                Log::warning('MongoDB Standalone detected. Retrying operation without transaction.');
                
                // Reset transaction level in Laravel just in case
                try {
                    $db->rollBack();
                } catch (\Throwable $t) {
                    // Ignore errors during rollback on standalone
                }
                
                // Retry the operation without a transaction block
                return $callback();
            }

            // For other errors, rollback and rethrow
            try {
                $db->rollBack();
            } catch (\Throwable $t) {}
            
            throw $e;
        }
    }
}
