<?php
// Fill only missing bundled local demo content; never reset existing tables.
$site = dirname(__DIR__) . '/E-commerce-6/local-app/shopperzz';
chdir($site);
require $site . '/vendor/autoload.php';
$app = require $site . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (Illuminate\Support\Facades\DB::connection()->getDatabaseName() !== 'ecommerce_local_6') throw new RuntimeException('Unexpected database; refusing repair.');
$seeders = [
    'benefits' => 'BenefitTableSeeder',
    'sliders' => 'SliderTableSeeder',
    'product_brands' => 'ProductBrandTableSeeder',
    'product_categories' => 'ProductCategoryTableSeeder',
    'taxes' => 'TaxTableSeeder',
    'units' => 'UnitTableSeeder',
    'product_attributes' => 'ProductAttributeTableSeeder',
    'product_attribute_options' => 'ProductAttributeOptionTableSeeder',
    'suppliers' => 'SupplierTableSeeder',
    'products' => 'ProductTableSeeder',
    'product_variations' => 'ProductVariationTableSeeder',
    'outlets' => 'OutletTableSeeder',
    'purchases' => 'PurchaseTableSeeder',
    'promotions' => 'PromotionTableSeeder',
    'product_sections' => 'ProductSectionTableSeeder',
    'pages' => 'PageTableSeeder',
];
$apply = in_array('--apply', $argv, true);
$envPath = $site . '/.env';
$original = file_get_contents($envPath);
try {
    if ($apply) {
        file_put_contents($envPath, preg_replace('/^DEMO=.*$/m', 'DEMO=true', $original));
        putenv('DEMO=true'); $_ENV['DEMO'] = 'true'; $_SERVER['DEMO'] = 'true';
    }
    foreach ($seeders as $table => $seeder) {
        $count = Illuminate\Support\Facades\DB::table($table)->count();
        echo $table . ': ' . $count . PHP_EOL;
        if ($apply && $count === 0) {
            echo 'Adding bundled ' . $seeder . PHP_EOL;
            app('Database\\Seeders\\' . $seeder)->run();
            echo 'Complete: ' . Illuminate\Support\Facades\DB::table($table)->count() . PHP_EOL;
        }
    }
} finally {
    if ($apply) file_put_contents($envPath, $original);
}
