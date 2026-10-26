-- Women's AS Colour tees: price by fabric weight (Basic < Maple < Box < Heavy)
-- instead of the importer's index-based band. Run after import_clothing --apply.
update products p
set price = case d.dataset_key
  when 'ascolour_4051' then 219000
  when 'ascolour_4001' then 249000
  when 'ascolour_4030' then 279000
  when 'ascolour_4080' then 309000
end
from shop_dataset_products d
where d.product_id = p.id
  and d.dataset_key in ('ascolour_4051', 'ascolour_4001', 'ascolour_4030', 'ascolour_4080');
