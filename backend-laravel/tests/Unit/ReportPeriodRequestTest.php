<?php

namespace Tests\Unit;

use App\Http\Requests\ReportPeriodRequest;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class ReportPeriodRequestTest extends TestCase
{
    private function validate(array $data): bool
    {
        $request = new ReportPeriodRequest();
        $validator = Validator::make($data, $request->rules());
        return $validator->passes();
    }

    public function test_valid_month_passes(): void
    {
        $this->assertTrue($this->validate(['month' => '2026-06']));
    }

    public function test_missing_month_passes(): void
    {
        $this->assertTrue($this->validate([]));
    }

    public function test_invalid_month_format_fails(): void
    {
        $this->assertFalse($this->validate(['month' => '2026-13']));
        $this->assertFalse($this->validate(['month' => '06-2026']));
        $this->assertFalse($this->validate(['month' => 'not-a-month']));
    }
}
