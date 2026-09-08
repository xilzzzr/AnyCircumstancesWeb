"""Audit the production prerender output. Run after npm run build; uses Python's standard library."""
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
SITE = 'https://anycircumstances.com'


class Element:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent = tag, dict(attrs), parent
        self.children = []

    def find(self, tag=None, **attrs):
        result = []
        for child in self.children:
            if isinstance(child, Element):
                if (tag is None or child.tag == tag) and all(child.attrs.get(k) == v for k, v in attrs.items()):
                    result.append(child)
                result.extend(child.find(tag, **attrs))
        return result

    def text(self):
        return ''.join(c.text() if isinstance(c, Element) else c for c in self.children)


class Document(HTMLParser):
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Element()
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in self.VOID:
            self.current = node

    def handle_endtag(self, tag):
        node = self.current
        while node.parent:
            if node.tag == tag:
                self.current = node.parent
                break
            node = node.parent

    def handle_data(self, data):
        self.current.children.append(data)


def require(value, message):
    if not value:
        raise AssertionError(message)


def audit():
    manifest = json.loads(subprocess.check_output(
        ['node', '--input-type=module', '-e',
         'import {getPrerenderManifest} from "./dist-ssr/entry-server.js"; console.log(JSON.stringify(getPrerenderManifest()));'],
        cwd=ROOT, text=True))
    paths = {route['path'] for route in manifest}
    require(len(paths) == len(manifest), 'Duplicate prerender routes')
    require(paths == set(json.loads((DIST / 'prerender-manifest.json').read_text())), 'Manifest mismatch')
    for file in [ROOT / 'public/sitemap.xml', DIST / 'sitemap.xml']:
        xml = ElementTree.parse(file)
        locations = [n.text for n in xml.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        require(len(locations) == len(paths), f'{file}: sitemap count')
        require(set(locations) == {SITE + p for p in paths}, f'{file}: sitemap paths')
    rows = []
    for route in manifest:
        path = route['path']
        html = (DIST / path.lstrip('/') / 'index.html').read_text()
        doc = Document(html).root
        main = doc.find('main')[0]
        title = doc.find('title')
        require(len(title) == 1 and title[0].text() == route['title'], f'{path}: title')
        for name, expected in [('description', route['description']), ('robots', 'index, follow, max-image-preview:large')]:
            tags = doc.find('meta', name=name)
            require(len(tags) == 1 and tags[0].attrs['content'] == expected, f'{path}: {name}')
        canonical = doc.find('link', rel='canonical')
        require(len(canonical) == 1 and canonical[0].attrs['href'] == SITE + path, f'{path}: canonical')
        h1 = main.find('h1')
        require(len(h1) == 1 and h1[0].text().strip(), f'{path}: H1')
        require(len(main.text().strip()) > 100, f'{path}: empty content')
        ctas = [e.attrs['data-cta'] for e in main.find() if 'data-cta' in e.attrs]
        checkout = any('Continue to checkout' in e.text() for e in main.find('button'))
        require(ctas or (path == '/pricing' and checkout), f'{path}: CTA')
        for tag in ['a', 'button']:
            for e in main.find(tag):
                require(not e.find('a') and not e.find('button'), f'{path}: nested interactive controls')
        for table in main.find('table'):
            columns = len(table.find('thead')[0].find('th'))
            for row in table.find('tbody')[0].find('tr'):
                require(len(row.find('th') + row.find('td')) == columns, f'{path}: malformed table')
        schemas = []
        for script in doc.find('script', type='application/ld+json'):
            value = json.loads(script.text())
            schemas.extend(value if isinstance(value, list) else [value])
        require(schemas == (route['schema'] if isinstance(route['schema'], list) else [route['schema']]), f'{path}: schema registry mismatch')
        types = [schema['@type'] for schema in schemas]
        if path.startswith('/guides/'):
            require('Article' in types and 'BreadcrumbList' in types, f'{path}: article schemas')
            article = next(s for s in schemas if s['@type'] == 'Article')
            require('By AnyCircumstances' in main.text(), f'{path}: byline')
            require(main.find('time', datetime=article['dateModified']), f'{path}: updated date')
            require(main.find('nav', **{'aria-label': 'Breadcrumb'}), f'{path}: breadcrumbs')
            for nav in main.find('nav', **{'aria-label': 'On this page'}):
                for link in nav.find('a'):
                    require(main.find(id=link.attrs['href'][1:]), f'{path}: broken TOC')
            for schema in schemas:
                if schema['@type'] == 'BreadcrumbList':
                    require([x['position'] for x in schema['itemListElement']] == [1, 2, 3], f'{path}: breadcrumb positions')
        if path == '/faq':
            faqs = json.loads((ROOT / 'src/data/faqs.ts').read_text().split(' = ', 1)[1].rstrip(';\n'))
            require(len(main.find('details')) == len(faqs) == 17, 'FAQ count')
            for faq in faqs:
                require(faq['question'] in main.text() and faq['answer'] in main.text(), 'FAQ copy missing from HTML')
        require(not re.search(r'most secure|guaranteed delivery|unhackable', main.text(), re.I), f'{path}: prohibited claim')
        links = [{'text': e.text().strip(), 'href': e.attrs['href']} for e in main.find('a') if 'href' in e.attrs]
        rows.append({'route': path, 'h1': h1[0].text().strip(), 'cta': ', '.join(ctas) or 'checkout',
                     'prerendered': True, 'sitemap': True, 'schema': ', '.join(types),
                     'title': route['title'], 'description': route['description'], 'links': links})
    for file in ['spa.html', '404.html']:
        doc = Document((DIST / file).read_text()).root
        require(doc.find('meta', name='robots')[0].attrs['content'].startswith('noindex'), f'{file}: noindex')
        require(not any('data-cta' in e.attrs for e in doc.find()), f'{file}: unexpected CTA banner')
    (DIST / 'public-audit.json').write_text(json.dumps(rows, indent=2) + '\n')
    print(f'Validated {len(rows)} public routes: metadata, source HTML, CTA coverage, sitemap XML, JSON-LD, guide dates/TOC, tables, FAQ answers and noindex fallbacks.')


if __name__ == '__main__':
    audit()
