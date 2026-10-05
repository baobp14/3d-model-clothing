import unicodedata


def normalize(value):
    return ' '.join(''.join(character for character in unicodedata.normalize('NFD', value.lower().replace('đ', 'd'))
                            if unicodedata.category(character) != 'Mn').split())


def search_products(products, categories, colors, query):
    tokens = normalize(query).split()
    if not tokens:
        return products
    category_names = {row.id: f'{row.name_vi} {row.name_en}' for row in categories}
    color_names = {row.id: f'{row.name_vi} {row.name_en}' for row in colors}
    departments = {'men': 'nam men', 'women': 'nu women', 'bags': 'tui phu kien bags accessories', 'watches': 'dong ho watches'}
    result = []
    for product in products:
        haystack = normalize(' '.join([
            str(product.id), product.name_vi, product.name_en, category_names.get(product.category, ''),
            departments.get(product.department, ''), *(color_names.get(color, color) for color in product.colors),
        ]))
        if all(token in haystack for token in tokens):
            result.append(product)
    return result
