package seed

import (
	"context"
	"embed"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/kapildev333/shopperstop/services/core/internal/blob"
)

// The demo catalog of design Decision 22 (catalog change, Decision 17). Ids
// are fixed: parents 0x501 to 0x50c, children 0x521 to 0x545, products 0x601
// to 0x694. Slugs are slugOf(name); names are unique so slugs are too.

// demoImages holds one placeholder PNG per parent, named by the parent's slug.
//
//go:embed images/*.png
var demoImages embed.FS

type demoCategory struct {
	name     string
	children []demoChild
}

type demoChild struct {
	name     string
	products []demoProduct
}

// demoProduct is {name, brand, unitLabel, mrpCents, priceCents, description}.
// Brands are invented; produce has none.
type demoProduct struct {
	name, brand, unitLabel string
	mrpCents, priceCents   int64
	description            string
}

var demoCatalog = []demoCategory{
	{"Fruits & Vegetables", []demoChild{
		{"Fresh Fruits", []demoProduct{
			{"Banana Robusta", "", "1 kg", 7000, 7000, "Ripe robusta bananas, sold by the kilo for everyday breakfasts."},
			{"Shimla Apple", "", "1 kg", 19900, 19900, "Crisp, tart red apples from Himachal orchards, a steady pick for lunchboxes."},
			{"Alphonso Mango", "", "1 kg", 45000, 39900, "Sweet, fragrant Alphonso mangoes, best eaten within two days of delivery."},
			{"Pomegranate Bhagwa", "", "1 kg", 32000, 32000, "Juicy Bhagwa pomegranates with deep red arils, good for juice and salads."},
		}},
		{"Fresh Vegetables", []demoProduct{
			{"Potato", "", "1 kg", 3500, 3500, "Firm washing potatoes for curries, fries and everyday cooking."},
			{"Onion", "", "1 kg", 4000, 3699, "Medium red onions with a long shelf life, the base of most Indian gravies."},
			{"Tomato Hybrid", "", "1 kg", 4500, 4500, "Firm hybrid tomatoes for chutneys, salads and sauces."},
			{"Green Capsicum", "", "500 g", 4000, 4000, "Glossy green capsicums, crunchy and mild for stir-fries."},
		}},
		{"Herbs & Seasonings", []demoProduct{
			{"Fresh Coriander", "", "100 g", 1500, 1399, "Bright green coriander leaves, washed and bunched for garnish."},
			{"Curry Leaves", "", "50 g", 1000, 1000, "Fragrant curry leaves picked for tempering dals and South Indian dishes."},
			{"Mint Leaves", "", "100 g", 1500, 1500, "Fresh pudina leaves for chutneys, raita and cold drinks."},
			{"Ginger", "", "250 g", 3000, 2400, "Knobby fresh ginger with a sharp, clean bite for tea and masalas."},
		}},
		{"Exotic Fruits & Veggies", []demoProduct{
			{"Dragon Fruit", "", "1 pc", 16000, 16000, "A single pink-skinned dragon fruit with sweet white flesh and black seeds."},
			{"Broccoli", "", "500 g", 13000, 13000, "Tight green broccoli florets on a firm stem, quick to steam or roast."},
			{"Zucchini", "", "500 g", 9000, 8199, "Smooth green zucchini that works in stir-fries, grills and bakes."},
			{"Cherry Tomatoes", "", "250 g", 9000, 9000, "Sweet red cherry tomatoes, good on their own or in salads."},
		}},
	}},
	{"Dairy, Bread & Eggs", []demoChild{
		{"Milk", []demoProduct{
			{"Sunny Fields Full Cream Milk", "Sunny Fields", "1 L", 7400, 7400, "Pasteurised full cream milk, chilled at the dark store for a thick cup of chai."},
			{"Sunny Fields Toned Milk", "Sunny Fields", "500 ml", 3000, 2799, "Toned milk in a small pack, for tea and cereal."},
			{"Pure Drop Double Toned Milk", "Pure Drop", "1 L", 6400, 6400, "Double toned milk with less fat, suited to daily tea and cereal."},
			{"Little Sprout Cow Milk", "Little Sprout", "500 ml", 3200, 3200, "Light cow milk pasteurised for families with young children."},
		}},
		{"Bread & Pav", []demoProduct{
			{"Urban Pantry Whole Wheat Bread", "Urban Pantry", "400 g", 5000, 4500, "Soft whole wheat sandwich loaf with no added preservatives."},
			{"Urban Pantry White Bread", "Urban Pantry", "400 g", 4500, 4500, "Soft white sandwich bread, sliced for toast."},
			{"Urban Pantry Pav Buns", "Urban Pantry", "6 pcs", 4000, 4000, "Six soft pav buns for bhaji or vada pav."},
			{"Sparkle Home Fruit Bread", "Sparkle Home", "400 g", 6000, 5499, "Sweet bread studded with raisins and dried fruit."},
		}},
		{"Eggs", []demoProduct{
			{"Blue Hill Farm Eggs Tray 6", "Blue Hill", "6 pcs", 4200, 4200, "Six brown-shell eggs from free-range farms, packed in a tray."},
			{"Blue Hill Eggs 12", "Blue Hill", "12 pcs", 8000, 8000, "Twelve white-shell eggs, graded and cleaned."},
			{"Blue Hill Quail Eggs", "Blue Hill", "12 pcs", 6000, 5400, "Small quail eggs, boiled and sliced for salads and snacks."},
			{"Blue Hill Egg White Liquid", "Blue Hill", "250 ml", 9900, 9900, "Pasteurised liquid egg whites for baking and protein shakes."},
		}},
		{"Paneer & Curd", []demoProduct{
			{"Sunny Fields Paneer", "Sunny Fields", "200 g", 9000, 9000, "Soft malai paneer cut into cubes for curries and tikka."},
			{"Sunny Fields Fresh Curd", "Sunny Fields", "400 g", 3800, 3499, "Set curd cultured daily, for raita and lassi."},
			{"Little Sprout Greek Yogurt", "Little Sprout", "400 g", 15000, 15000, "Thick, unsweetened Greek style yogurt with a high protein count."},
			{"Pure Drop Butter Milk", "Pure Drop", "200 ml", 1500, 1500, "Spiced buttermilk made from fresh curd and roasted cumin."},
		}},
	}},
	{"Atta, Rice & Dal", []demoChild{
		{"Atta & Flours", []demoProduct{
			{"Sparkle Home Whole Wheat Atta", "Sparkle Home", "5 kg", 37500, 31900, "Stone-ground whole wheat atta for soft rotis every day."},
			{"Sparkle Home Multigrain Atta", "Sparkle Home", "5 kg", 52000, 52000, "Multigrain atta with bajra, jowar and ragi for a heartier roti."},
			{"Sparkle Home Besan", "Sparkle Home", "1 kg", 14000, 14000, "Fine gram flour for pakoras, kadhi and sweets."},
			{"Urban Pantry Maida", "Urban Pantry", "1 kg", 5000, 4599, "Refined wheat flour for naans, samosa sheets and baking."},
		}},
		{"Rice", []demoProduct{
			{"Blue Hill Sona Masuri Rice", "Blue Hill", "5 kg", 52000, 52000, "Light, aromatic Sona Masuri rice for everyday meals."},
			{"Blue Hill Basmati Rice", "Blue Hill", "1 kg", 22000, 22000, "Long-grain aged basmati with a nutty fragrance for biryani."},
			{"Blue Hill Poha", "Blue Hill", "500 g", 6000, 5500, "Flattened rice flakes for quick breakfast poha."},
			{"Urban Pantry Brown Rice", "Urban Pantry", "1 kg", 9000, 9000, "Unpolished brown rice with its bran, a chewy everyday grain."},
		}},
		{"Dals & Pulses", []demoProduct{
			{"Pure Drop Toor Dal", "Pure Drop", "1 kg", 18000, 18000, "Split pigeon peas, cleaned and polished for daily sambar and dal."},
			{"Pure Drop Moong Dal", "Pure Drop", "1 kg", 16000, 14499, "Split yellow moong dal that cooks soft in twenty minutes."},
			{"Pure Drop Chana Dal", "Pure Drop", "500 g", 9000, 9000, "Split Bengal gram for tadka dal and chutneys."},
			{"Crunchy Bay Rajma", "Crunchy Bay", "1 kg", 16000, 16000, "Red kidney beans, sorted and cleaned for a rich rajma curry."},
		}},
	}},
	{"Oil, Ghee & Masala", []demoChild{
		{"Cooking Oil", []demoProduct{
			{"Sunny Fields Sunflower Oil", "Sunny Fields", "1 L", 16000, 14900, "Light refined sunflower oil for frying and everyday cooking."},
			{"Sunny Fields Groundnut Oil", "Sunny Fields", "1 L", 19000, 19000, "Groundnut oil with a mild nutty taste."},
			{"Crunchy Bay Mustard Oil", "Crunchy Bay", "500 ml", 9500, 9500, "Pungent mustard oil for Bengali fish curries and pickles."},
			{"Crunchy Bay Olive Oil", "Crunchy Bay", "500 ml", 49900, 44999, "Light olive oil for shallow frying and dressings."},
		}},
		{"Ghee", []demoProduct{
			{"Masala Ghar Cow Ghee", "Masala Ghar", "500 ml", 56000, 56000, "Clarified butter made from cow milk, with a golden grain."},
			{"Masala Ghar Desi Ghee", "Masala Ghar", "1 L", 105000, 105000, "Traditional desi ghee for dal tadka and sweets."},
			{"Pure Drop Vanaspati", "Pure Drop", "500 g", 13000, 11799, "Vegetable ghee for baking and frying."},
			{"Masala Ghar Salted Butter", "Masala Ghar", "100 g", 5800, 5800, "Salted table butter for toast, parathas and cooking."},
		}},
		{"Spices & Masalas", []demoProduct{
			{"Masala Ghar Turmeric Powder", "Masala Ghar", "200 g", 4500, 4500, "Ground turmeric with a deep yellow colour for everyday curries."},
			{"Masala Ghar Red Chilli Powder", "Masala Ghar", "200 g", 7000, 6399, "Hot red chilli powder for a bright, spicy gravy."},
			{"Masala Ghar Garam Masala", "Masala Ghar", "100 g", 8500, 8500, "Blend of cinnamon, clove and cardamom for finishing curries."},
			{"Masala Ghar Cumin Seeds", "Masala Ghar", "100 g", 6000, 6000, "Whole jeera seeds for tempering dal and rice."},
		}},
	}},
	{"Snacks & Munchies", []demoChild{
		{"Chips & Crisps", []demoProduct{
			{"Crunchy Bay Salted Potato Chips", "Crunchy Bay", "100 g", 2000, 1899, "Thin potato chips lightly salted, a crisp snack for the evening."},
			{"Crunchy Bay Masala Chips", "Crunchy Bay", "150 g", 3000, 3000, "Potato chips with a tangy masala dusting."},
			{"Crunchy Bay Banana Chips", "Crunchy Bay", "150 g", 6000, 6000, "Crisp, lightly salted banana chips cut into thin rounds."},
			{"Sparkle Home Veggie Crisps", "Sparkle Home", "90 g", 5000, 4599, "Baked vegetable crisps made from potato, carrot and spinach."},
		}},
		{"Namkeen", []demoProduct{
			{"Masala Ghar Aloo Bhujia", "Masala Ghar", "200 g", 6000, 6000, "Crunchy bhujia made from gram flour, with a mild spice."},
			{"Masala Ghar Moong Dal Namkeen", "Masala Ghar", "200 g", 6000, 6000, "Fried moong dal with roasted peanuts and curry leaves."},
			{"Masala Ghar Chivda", "Masala Ghar", "200 g", 5500, 4900, "Flattened rice mix with peanuts, cashews and raisins."},
			{"Urban Pantry Mixture", "Urban Pantry", "250 g", 7500, 7500, "Savoury mix of sev, peanuts and crisp lentils."},
		}},
		{"Biscuits & Cookies", []demoProduct{
			{"Sparkle Home Marie Biscuits", "Sparkle Home", "250 g", 3000, 3000, "Plain tea-time marie biscuits."},
			{"Sparkle Home Butter Cookies", "Sparkle Home", "200 g", 9500, 8599, "Buttery cookies with a crumbly texture, ideal with evening chai."},
			{"Little Sprout Oats Cookies", "Little Sprout", "150 g", 8000, 8000, "Oat and jaggery cookies with no refined sugar."},
			{"Urban Pantry Digestive Biscuits", "Urban Pantry", "300 g", 7500, 7500, "Wholemeal digestive biscuits, lightly sweet."},
		}},
	}},
	{"Breakfast & Instant Food", []demoChild{
		{"Cereals & Oats", []demoProduct{
			{"Little Sprout Rolled Oats", "Little Sprout", "1 kg", 28000, 24900, "Whole rolled oats for porridge, overnight oats and upma."},
			{"Little Sprout Muesli", "Little Sprout", "500 g", 32000, 32000, "Toasted muesli with almonds, raisins and seeds."},
			{"Little Sprout Corn Flakes", "Little Sprout", "500 g", 22000, 22000, "Crisp corn flakes, lightly sweetened, served with milk."},
			{"Little Sprout Ragi Flakes", "Little Sprout", "300 g", 14000, 12699, "Finger millet flakes that are high in calcium and fibre."},
		}},
		{"Noodles & Pasta", []demoProduct{
			{"Blue Hill Instant Noodles Masala", "Blue Hill", "70 g", 1400, 1400, "Two-minute masala noodles, a quick hot meal."},
			{"Blue Hill Penne Pasta", "Blue Hill", "500 g", 13000, 13000, "Durum wheat penne that holds its shape in tomato sauce."},
			{"Blue Hill Macaroni", "Blue Hill", "400 g", 11000, 9999, "Elbow macaroni for baked cheese dishes."},
			{"Blue Hill Vermicelli", "Blue Hill", "200 g", 4000, 4000, "Thin roasted vermicelli for upma and kheer."},
		}},
		{"Ready to Cook", []demoProduct{
			{"Masala Ghar Poha Mix", "Masala Ghar", "180 g", 4500, 4500, "Ready spice mix for a quick poha breakfast."},
			{"Masala Ghar Idli Dosa Batter", "Masala Ghar", "1 kg", 9000, 8000, "Fermentation-ready batter of rice and urad dal."},
			{"Urban Pantry Upma Mix", "Urban Pantry", "200 g", 5000, 5000, "Dry upma mix with semolina and vegetables, ready in ten minutes."},
			{"Crunchy Bay Pav Bhaji Masala", "Crunchy Bay", "100 g", 8000, 8000, "Spice blend for a rich pav bhaji."},
		}},
	}},
	{"Cold Drinks & Juices", []demoChild{
		{"Soft Drinks", []demoProduct{
			{"Sparkle Home Lemon Soda", "Sparkle Home", "750 ml", 4000, 3699, "Sparkling lemon soda with a light citrus finish."},
			{"Sparkle Home Cola", "Sparkle Home", "750 ml", 4500, 4500, "Classic cola served cold."},
			{"Crunchy Bay Ginger Ale", "Crunchy Bay", "600 ml", 4500, 4500, "Ginger ale with a gentle spicy bite."},
			{"Urban Pantry Orange Fizz", "Urban Pantry", "2 L", 9900, 8999, "Orange flavoured carbonated drink for parties."},
		}},
		{"Fruit Juices", []demoProduct{
			{"Pure Drop Mango Juice", "Pure Drop", "1 L", 12000, 12000, "Mango pulp juice made from ripe Totapuri and Badami mangoes."},
			{"Pure Drop Orange Juice", "Pure Drop", "1 L", 14000, 14000, "Orange juice with no added sugar."},
			{"Little Sprout Apple Juice", "Little Sprout", "200 ml", 3000, 2600, "Pressed apple juice in a small carton for kids' lunchboxes."},
			{"Pure Drop Mixed Fruit Juice", "Pure Drop", "1 L", 13500, 13500, "Blend of mango, guava and pineapple for a sweet morning glass."},
		}},
		{"Water & Soda", []demoProduct{
			{"Pure Drop Packaged Water", "Pure Drop", "1 L", 2000, 2000, "Mineral water sealed in a bottle, chilled and ready to drink."},
			{"Pure Drop Packaged Water 5 L", "Pure Drop", "5 L", 10000, 8000, "Five litre can of purified drinking water for the home."},
			{"Sparkle Home Soda", "Sparkle Home", "750 ml", 2500, 2500, "Plain soda water for mixing cocktails and mocktails."},
			{"Little Sprout Coconut Water", "Little Sprout", "200 ml", 3500, 3500, "Tender coconut water, naturally sweet and light."},
		}},
	}},
	{"Tea, Coffee & Health Drinks", []demoChild{
		{"Tea", []demoProduct{
			{"Sunny Fields Assam Tea", "Sunny Fields", "500 g", 27000, 24900, "Strong CTC Assam tea for a bold morning cup."},
			{"Sunny Fields Masala Chai", "Sunny Fields", "250 g", 16000, 16000, "Tea blended with cardamom and ginger for a spiced cup."},
			{"Sunny Fields Green Tea", "Sunny Fields", "100 g", 12000, 12000, "Unflavoured green tea leaves steeped for a light cup."},
			{"Sunny Fields Lemon Tea", "Sunny Fields", "100 g", 9000, 8199, "Black tea with dried lemon peel for a bright finish."},
		}},
		{"Coffee", []demoProduct{
			{"Blue Hill Instant Coffee", "Blue Hill", "100 g", 26000, 26000, "Freeze-dried instant coffee with a rich aroma."},
			{"Blue Hill Filter Coffee Powder", "Blue Hill", "250 g", 34000, 34000, "Dark roast filter coffee with chicory for South Indian style brewing."},
			{"Blue Hill Cold Coffee", "Blue Hill", "250 ml", 3500, 3199, "Ready to drink cold coffee, chilled and sweetened."},
			{"Blue Hill Espresso Beans", "Blue Hill", "250 g", 52000, 52000, "Medium-dark roasted espresso beans for home machines."},
		}},
		{"Health Drinks", []demoProduct{
			{"Little Sprout Malt Drink", "Little Sprout", "500 g", 27000, 27000, "Malted cereal drink mix with calcium and vitamins."},
			{"Little Sprout Health Mix Chocolate", "Little Sprout", "500 g", 28000, 25299, "Chocolate flavoured health drink mix for growing children."},
			{"Urban Pantry Ragi Malt", "Urban Pantry", "400 g", 19000, 19000, "Ragi malt powder, a finger millet drink with no added colours."},
			{"Little Sprout Protein Shake", "Little Sprout", "250 g", 60000, 60000, "Whey protein shake powder, vanilla flavoured."},
		}},
	}},
	{"Sweet Tooth", []demoChild{
		{"Chocolates", []demoProduct{
			{"Sparkle Home Dark Chocolate", "Sparkle Home", "100 g", 15000, 12500, "Seventy per cent dark chocolate bar with a slightly bitter finish."},
			{"Sparkle Home Milk Chocolate", "Sparkle Home", "50 g", 6000, 6000, "Creamy milk chocolate bar, a pocket-sized treat."},
			{"Sparkle Home Hazelnut Bar", "Sparkle Home", "75 g", 9500, 9500, "Milk chocolate with whole hazelnuts."},
			{"Crunchy Bay Choco Wafers", "Crunchy Bay", "150 g", 8000, 6500, "Crisp wafer rolls with a cocoa cream filling."},
		}},
		{"Ice Creams", []demoProduct{
			{"Sunny Fields Vanilla Ice Cream", "Sunny Fields", "1 L", 35000, 35000, "Vanilla ice cream with real vanilla bean specks, kept frozen."},
			{"Sunny Fields Kulfi", "Sunny Fields", "4 pcs", 12000, 12000, "Four traditional pistachio kulfi sticks, frozen solid."},
			{"Sunny Fields Mango Ice Cream", "Sunny Fields", "500 ml", 18000, 16000, "Mango ice cream made with Alphonso pulp."},
			{"Sunny Fields Choco Cone", "Sunny Fields", "1 pc", 3500, 3500, "Single chocolate ice cream cone with a crisp wafer shell."},
		}},
		{"Indian Sweets", []demoProduct{
			{"Masala Ghar Gulab Jamun Mix", "Masala Ghar", "200 g", 8000, 8000, "Ready mix for soft gulab jamun, add milk and fry."},
			{"Masala Ghar Kaju Katli", "Masala Ghar", "250 g", 50000, 45000, "Cashew fudge sliced into diamonds, lightly sweet."},
			{"Masala Ghar Besan Laddoo", "Masala Ghar", "250 g", 22000, 22000, "Gram flour laddoos with ghee and cardamom."},
			{"Masala Ghar Rasgulla Tin", "Masala Ghar", "500 g", 19000, 19000, "Soft cottage cheese balls in light syrup."},
		}},
	}},
	{"Cleaning Essentials", []demoChild{
		{"Detergents", []demoProduct{
			{"Sparkle Home Detergent Powder", "Sparkle Home", "1 kg", 16000, 13900, "Front-load safe detergent powder for everyday laundry."},
			{"Sparkle Home Liquid Detergent", "Sparkle Home", "1 L", 24000, 24000, "Liquid detergent that removes oil stains in cold water."},
			{"Sparkle Home Detergent Bar", "Sparkle Home", "250 g", 2500, 2500, "Laundry soap bar for hand washing and pre-treating stains."},
			{"Urban Pantry Fabric Softener", "Urban Pantry", "1 L", 19900, 17500, "Softener with a floral fragrance that keeps clothes soft."},
		}},
		{"Dishwash", []demoProduct{
			{"Sparkle Home Dishwash Gel", "Sparkle Home", "750 ml", 14000, 14000, "Lemon gel dishwash that cuts grease quickly."},
			{"Sparkle Home Dishwash Bar", "Sparkle Home", "300 g", 4000, 4000, "Dishwash bar for pots and pans."},
			{"Sparkle Home Scrub Pad", "Sparkle Home", "3 pcs", 4500, 3900, "Three heavy-duty scrub pads for non-stick cookware."},
			{"Urban Pantry Dish Liquid Refill", "Urban Pantry", "1.5 L", 24000, 24000, "Economy refill pack of dishwash liquid."},
		}},
		{"Floor & Surface Cleaners", []demoProduct{
			{"Urban Pantry Floor Cleaner", "Urban Pantry", "1 L", 15000, 15000, "Floor cleaner with a pine scent for mopping tiles."},
			{"Urban Pantry Toilet Cleaner", "Urban Pantry", "500 ml", 11000, 9999, "Thick toilet cleaner that reaches under the rim."},
			{"Urban Pantry Glass Cleaner", "Urban Pantry", "500 ml", 9000, 9000, "Streak-free glass and mirror cleaner."},
			{"Pure Drop Disinfectant Spray", "Pure Drop", "500 ml", 22000, 22000, "Surface disinfectant spray that kills germs on counters."},
		}},
	}},
	{"Personal Care", []demoChild{
		{"Bath & Body", []demoProduct{
			{"Sparkle Home Bath Soap", "Sparkle Home", "100 g", 4000, 3500, "Gentle bath soap with glycerine for daily use."},
			{"Sparkle Home Body Wash", "Sparkle Home", "250 ml", 19900, 19900, "Body wash with a fresh citrus scent."},
			{"Urban Pantry Shower Gel", "Urban Pantry", "250 ml", 19900, 19900, "Shower gel with aloe for dry skin."},
			{"Blue Hill Body Lotion", "Blue Hill", "200 ml", 24900, 22500, "Non-greasy body lotion with shea butter."},
		}},
		{"Hair Care", []demoProduct{
			{"Blue Hill Shampoo", "Blue Hill", "340 ml", 24000, 24000, "Daily shampoo that cleans without drying."},
			{"Blue Hill Hair Oil", "Blue Hill", "200 ml", 12000, 12000, "Coconut and amla hair oil for strong roots."},
			{"Blue Hill Conditioner", "Blue Hill", "200 ml", 19900, 17999, "Smoothing conditioner for frizz control."},
			{"Pure Drop Hair Serum", "Pure Drop", "100 ml", 30000, 30000, "Light serum that adds shine to dry ends."},
		}},
		{"Oral Care", []demoProduct{
			{"Crunchy Bay Toothpaste", "Crunchy Bay", "150 g", 11000, 11000, "Fluoride toothpaste with a mint flavour."},
			{"Crunchy Bay Toothbrush", "Crunchy Bay", "2 pcs", 6000, 5499, "Soft-bristle toothbrushes, two in a pack."},
			{"Crunchy Bay Mouthwash", "Crunchy Bay", "250 ml", 14000, 14000, "Alcohol-free mouthwash for fresh breath."},
			{"Crunchy Bay Dental Floss", "Crunchy Bay", "50 m", 7000, 7000, "Waxed dental floss that slides between tight teeth."},
		}},
	}},
	{"Baby Care", []demoChild{
		{"Diapers & Wipes", []demoProduct{
			{"Little Sprout Diapers Medium", "Little Sprout", "36 pcs", 79900, 69900, "Medium size diapers with a soft inner layer, 36 count."},
			{"Little Sprout Baby Wipes", "Little Sprout", "72 pcs", 19900, 19900, "Fragrance-free wipes, gentle for sensitive skin."},
			{"Little Sprout Diaper Pants Large", "Little Sprout", "30 pcs", 84900, 84900, "Pull-up diaper pants for active toddlers."},
			{"Little Sprout Diaper Rash Cream", "Little Sprout", "50 g", 17000, 15399, "Zinc-based cream that protects against rash."},
		}},
		{"Baby Food", []demoProduct{
			{"Little Sprout Ragi Porridge", "Little Sprout", "300 g", 22000, 22000, "Instant ragi porridge for babies from six months."},
			{"Little Sprout Rice Cereal", "Little Sprout", "250 g", 18000, 18000, "Iron-fortified rice cereal, mixed with breast milk or formula."},
			{"Little Sprout Apple Puree Pouch", "Little Sprout", "100 g", 9000, 8000, "Apple puree pouch with no added sugar."},
			{"Little Sprout Baby Biscuits", "Little Sprout", "120 g", 9500, 9500, "Mild biscuits for teething babies."},
		}},
	}},
}

// slugOf is the slug the catalog derives from a name: lower case, runs of
// anything but a-z and 0-9 become one hyphen, no leading or trailing hyphen.
func slugOf(name string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(name) {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			b.WriteRune(r)
		} else if b.Len() > 0 && b.String()[b.Len()-1] != '-' {
			b.WriteByte('-')
		}
	}
	return strings.TrimSuffix(b.String(), "-")
}

func demoID(n int) string {
	return fmt.Sprintf("00000000-0000-4000-8000-%012x", n)
}

// Files writes the demo images: each parent's placeholder under products/ and
// categories/ as seed-<parent slug>.png, which is the image key of every
// product and category under that parent.
func Files(ctx context.Context, files blob.Store) error {
	for _, c := range demoCatalog {
		slug := slugOf(c.name)
		img, err := demoImages.ReadFile("images/" + slug + ".png")
		if err != nil {
			return fmt.Errorf("read demo image %s: %w", slug, err)
		}
		for _, kind := range []string{"products", "categories"} {
			key := kind + "/seed-" + slug + ".png"
			if err := files.Put(ctx, key, img); err != nil {
				return fmt.Errorf("write demo image %s: %w", key, err)
			}
		}
	}
	return nil
}

// loadCatalog inserts the demo categories (parents, then children) and then
// the products, with explicit ids.
func loadCatalog(ctx context.Context, tx pgx.Tx) error {
	child, product := 0, 0
	for i, c := range demoCatalog {
		parentSlug := slugOf(c.name)
		parentID := demoID(0x500 + i + 1)
		if _, err := tx.Exec(ctx,
			"insert into categories (id, name, slug, parent_id, sort_order, image_key) values ($1, $2, $3, null, $4, $5)",
			parentID, c.name, parentSlug, 10*(i+1), "categories/seed-"+parentSlug+".png"); err != nil {
			return fmt.Errorf("insert demo category %s: %w", c.name, err)
		}
		for j, ch := range c.children {
			child++
			childID := demoID(0x520 + child)
			if _, err := tx.Exec(ctx,
				"insert into categories (id, name, slug, parent_id, sort_order, image_key) values ($1, $2, $3, $4, $5, $6)",
				childID, ch.name, slugOf(ch.name), parentID, 10*(j+1), "categories/seed-"+parentSlug+".png"); err != nil {
				return fmt.Errorf("insert demo category %s: %w", ch.name, err)
			}
			for _, p := range ch.products {
				product++
				if _, err := tx.Exec(ctx, `insert into products
					(id, category_id, name, slug, brand, description, unit_label, mrp_cents, price_cents, is_active, image_key)
					values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
					demoID(0x600+product), childID, p.name, slugOf(p.name), p.brand, p.description, p.unitLabel,
					p.mrpCents, p.priceCents, product != 148, "products/seed-"+parentSlug+".png"); err != nil {
					return fmt.Errorf("insert demo product %s: %w", p.name, err)
				}
			}
		}
	}
	return nil
}
