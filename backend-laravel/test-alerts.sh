#!/bin/bash

echo "🧪 DuitFam Alert Testing Script"
echo "================================"
echo ""
echo "This script will create test transactions to trigger different alerts."
echo ""

# Get the API URL and token from user
echo "Please provide your auth token (from localStorage after login):"
read -p "Auth Token: " AUTH_TOKEN

API_URL="http://localhost:8000/api"

echo ""
echo "Choose which alert to test:"
echo "1. 🚨 Warning: Expenses exceed income (High Severity)"
echo "2. ⚠️ Warning: Almost exceeded budget (>90%)"
echo "3. 📊 Warning: Category spending too high (>30%)"
echo "4. ✅ Success: Healthy finances (<70%)"
echo "5. 🤖 Test Hybrid AI Chat (Cloud -> Local -> Rule)"
echo ""
read -p "Enter choice (1-5): " CHOICE

case $CHOICE in
    1)
        echo ""
        echo "🚨 Creating HIGH SEVERITY alert test..."
        echo "This will create expenses that exceed income."
        echo ""

        # Create income first
        curl -X POST "$API_URL/transactions" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "jenis": "pemasukan",
                "jumlah": 1000000,
                "tanggal": "'$(date +%Y-%m-%d)'",
                "keterangan": "Test income for alert testing",
                "id_kategori": null
            }'

        echo -e "\n\n✅ Income created: Rp 1,000,000"
        echo "Creating expenses: Rp 1,200,000..."

        # Create expenses that exceed income
        curl -X POST "$API_URL/transactions" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "jenis": "pengeluaran",
                "jumlah": 800000,
                "tanggal": "'$(date +%Y-%m-%d)'",
                "keterangan": "Test expense - Food",
                "id_kategori": null
            }'

        curl -X POST "$API_URL/transactions" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "jenis": "pengeluaran",
                "jumlah": 400000,
                "tanggal": "'$(date +%Y-%m-%d)'",
                "keterangan": "Test expense - Shopping",
                "id_kategori": null
            }'

        echo -e "\n\n✅ Test complete! Refresh your dashboard to see the alert."
        ;;

    2)
        echo ""
        echo "⚠️ Creating MEDIUM WARNING alert test..."
        echo "This will create expenses at ~95% of income."
        echo ""

        curl -X POST "$API_URL/transactions" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "jenis": "pemasukan",
                "jumlah": 1000000,
                "tanggal": "'$(date +%Y-%m-%d)'",
                "keterangan": "Test income",
                "id_kategori": null
            }'

        echo -e "\n✅ Income: Rp 1,000,000"
        echo "Creating expenses: Rp 950,000..."

        curl -X POST "$API_URL/transactions" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "jenis": "pengeluaran",
                "jumlah": 950000,
                "tanggal": "'$(date +%Y-%m-%d)'",
                "keterangan": "Test expense at 95%",
                "id_kategori": null
            }'

        echo -e "\n\n✅ Test complete! Refresh dashboard to see the alert."
        ;;

    3)
        echo ""
        echo "📊 Creating CATEGORY SPENDING alert test..."
        echo "This will create one category with >30% spending."
        echo ""

        curl -X POST "$API_URL/transactions" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "jenis": "pemasukan",
                "jumlah": 1000000,
                "tanggal": "'$(date +%Y-%m-%d)'",
                "keterangan": "Test income",
                "id_kategori": null
            }'

        echo -e "\n✅ Income: Rp 1,000,000"
        echo "Creating single category expense: Rp 500,000 (50%)..."

        curl -X POST "$API_URL/transactions" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "jenis": "pengeluaran",
                "jumlah": 500000,
                "tanggal": "'$(date +%Y-%m-%d)'",
                "keterangan": "Test - Food category dominant",
                "id_kategori": null
            }'

        echo -e "\n\n✅ Test complete! Refresh dashboard to see the alert."
        ;;

    4)
        echo ""
        echo "✅ Creating SUCCESS/HEALTHY alert test..."
        echo "This will create expenses at only ~50% of income."
        echo ""

        curl -X POST "$API_URL/transactions" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "jenis": "pemasukan",
                "jumlah": 1000000,
                "tanggal": "'$(date +%Y-%m-%d)'",
                "keterangan": "Test income",
                "id_kategori": null
            }'

        echo -e "\n✅ Income: Rp 1,000,000"
        echo "Creating healthy expenses: Rp 500,000 (50%)..."

        curl -X POST "$API_URL/transactions" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "jenis": "pengeluaran",
                "jumlah": 300000,
                "tanggal": "'$(date +%Y-%m-%d)'",
                "keterangan": "Test expense - low spending",
                "id_kategori": null
            }'

        echo -e "\n\n✅ Test complete! Refresh dashboard to see the success alert."
        ;;

    5)
        echo ""
        echo "🤖 Testing Triple-Tier Hybrid AI Chat..."
        echo "Scenario: Cloud -> Local -> Rule-based"
        echo ""

        RESPONSE=$(curl -s -X POST "$API_URL/ai/chat" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "message": "Bagaimana pengeluaran saya bulan ini?"
            }')

        echo "Response from AI:"
        echo "$RESPONSE" | python3 -m json.tool
        ;;

    *)
        echo "❌ Invalid choice!"
        exit 1
        ;;
esac

echo ""
echo "================================"
echo "✅ Testing complete!"
echo ""
