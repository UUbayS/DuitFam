<?php

namespace App\Traits;

trait ApiResponseTrait
{
    public function successResponse($data = null, $message = 'Success', $code = 200)
    {
        return response()->json([
            'message' => $message,
            'data' => $data
        ], $code);
    }

    public function errorResponse($message = 'Error', $errors = [], $code = 400)
    {
        return response()->json([
            'message' => $message,
            'errors' => $errors
        ], $code);
    }
}
