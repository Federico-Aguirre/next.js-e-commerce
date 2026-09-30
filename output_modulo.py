#!/usr/bin/env python3
"""Página de contacto WSGI autónoma, auditada y con pruebas pytest.

Ejecutar servidor: python output_modulo.py
Ejecutar pruebas:  pytest -q output_modulo.py

Auditoría del código recibido:
* ``str.isdigit()`` aceptaba dígitos Unicode no ASCII; corregido para dejar
  pasar únicamente dígitos ASCII al crear números E.164.
* ``urlencode`` codificaba espacios en mensajes como ``+``; corregido para
  usar ``%20``, igual que ``encodeURIComponent``.
* La URL Google Maps ahora preserva la coma entre coordenadas como lo define
  el contrato. Se codifica el locale de forma segura.
* Se conserva la defensa runtime ante proveedores de mapa no soportados.

Límites observados y cubiertos por pruebas: países desconocidos no tienen
prefijo de marcado; los teléfonos no válidos conservan el fallback original
al formatear; el formulario demo no persiste ni envía datos.
"""
from __future__ import annotations

from dataclasses import dataclass
from html import escape
from http import HTTPStatus
from typing import Final, Literal, Mapping
from urllib.parse import quote, urlparse, parse_qs
from wsgiref.simple_server import make_server

MapProvider = Literal["google-maps", "openstreetmap"]
ContactPhoneKind = Literal["whatsapp", "direct"]


@dataclass(frozen=True)
class GeoCoordinates:
    lat: float
    lng: float


@dataclass(frozen=True)
class ContactPhone:
    id: str
    kind: ContactPhoneKind
    country_code: str
    national_number: str


@dataclass(frozen=True)
class PostalAddress:
    line1: str
    city: str
    state: str
    postal_code: str
    country: str
    line2: str | None = None


@dataclass(frozen=True)
class ContactInfo:
    coordinates: GeoCoordinates
    address: PostalAddress
    primary_phone: ContactPhone
    secondary_phone: ContactPhone
    map_provider: MapProvider
    map_zoom: int


# Fuente única de verdad. Teléfonos ficticios reservados 555-01xx.
CONTACT_INFO: Final[ContactInfo] = ContactInfo(
    coordinates=GeoCoordinates(25.761681, -80.191788),
    address=PostalAddress("100 Ocean Drive", "Miami", "FL", "33139",
                          "United States", "Suite 200"),
    primary_phone=ContactPhone("whatsapp-primary", "whatsapp", "US", "3055550142"),
    secondary_phone=ContactPhone("phone-secondary", "direct", "US", "3055550198"),
    map_provider="google-maps",
    map_zoom=16,
)

COUNTRY_DIAL_CODES: Final[Mapping[str, str]] = {"US": "1"}
MESSAGES: Final[Mapping[str, Mapping[str, str]]] = {
    "en": {
        "page_title": "Contact us", "form_title": "Send us a message",
        "name": "Name", "email": "Email", "message": "Message",
        "submit": "Send message",
        "form_note": "This demo form does not send or store messages.",
        "office_title": "Our office",
        "map_title": "Map of our office in Miami, Florida, USA",
        "get_directions": "Get directions",
        "wa_message": "Hello! I would like to receive more information.",
        "wa_aria": "Contact {phone} via WhatsApp Web", "phone_aria": "Call {phone}",
        "whatsapp": "WhatsApp", "call": "Call",
        "submitted": "Thank you. Your message was not sent because this demo has no mail service.",
        "language": "Language",
    },
    "es": {
        "page_title": "Contáctanos", "form_title": "Envíanos un mensaje",
        "name": "Nombre", "email": "Correo electrónico", "message": "Mensaje",
        "submit": "Enviar mensaje",
        "form_note": "Este formulario de demostración no envía ni almacena mensajes.",
        "office_title": "Nuestra oficina",
        "map_title": "Mapa de la oficina en Miami, Florida, Estados Unidos",
        "get_directions": "Cómo llegar",
        "wa_message": "¡Hola! Me gustaría recibir más información.",
        "wa_aria": "Contactar al {phone} vía WhatsApp Web", "phone_aria": "Llamar al {phone}",
        "whatsapp": "WhatsApp", "call": "Llamar",
        "submitted": "Gracias. Tu mensaje no se envió porque esta demostración no tiene servicio de correo.",
        "language": "Idioma",
    },
}


def _digits(value: str) -> str:
    """Extrae dígitos ASCII (str.isdigit por sí solo acepta cifras Unicode)."""
    return "".join(ch for ch in value if ch.isascii() and ch.isdigit())


def to_e164(phone: ContactPhone) -> str:
    dial_code = COUNTRY_DIAL_CODES.get(phone.country_code.upper(), "")
    return f"+{dial_code}{_digits(phone.national_number)}"


def format_national(phone: ContactPhone) -> str:
    number = _digits(phone.national_number)
    if len(number) != 10:
        return phone.national_number
    return f"({number[:3]}) {number[3:6]}-{number[6:]}"


def build_whatsapp_url(phone: ContactPhone, message: str | None = None) -> str:
    number = to_e164(phone).lstrip("+")
    base = f"https://wa.me/{number}"
    if not message:
        return base
    return f"{base}?text={quote(message, safe='')}"


def build_tel_url(phone: ContactPhone) -> str:
    return f"tel:{to_e164(phone)}"


def build_map_embed_url(coordinates: GeoCoordinates, provider: MapProvider,
                        zoom: int, locale: str) -> str:
    if provider == "google-maps":
        point = quote(f"{coordinates.lat},{coordinates.lng}", safe=",")
        language = quote(locale, safe="")
        return (f"https://www.google.com/maps?q={point}&hl={language}"
                f"&z={zoom}&output=embed")
    if provider == "openstreetmap":
        delta = 0.01
        bbox = (f"{coordinates.lng-delta},{coordinates.lat-delta},"
                f"{coordinates.lng+delta},{coordinates.lat+delta}")
        marker = f"{coordinates.lat},{coordinates.lng}"
        return ("https://www.openstreetmap.org/export/embed.html"
                f"?bbox={bbox}&layer=mapnik&marker={marker}")
    raise ValueError(f"Proveedor de mapa no soportado: {provider!r}")


def build_directions_url(coordinates: GeoCoordinates) -> str:
    point = quote(f"{coordinates.lat},{coordinates.lng}", safe=",")
    return f"https://www.google.com/maps/dir/?api=1&destination={point}"


def _text(value: object) -> str:
    return escape(str(value), quote=True)


def _render_contact_form(messages: Mapping[str, str]) -> str:
    return f"""
<section class="card form-card" aria-labelledby="contact-form-heading">
<h2 id="contact-form-heading">{_text(messages['form_title'])}</h2>
<form method="post">
<label for="name">{_text(messages['name'])}</label>
<input id="name" name="name" type="text" autocomplete="name" required>
<label for="email">{_text(messages['email'])}</label>
<input id="email" name="email" type="email" autocomplete="email" required>
<label for="message">{_text(messages['message'])}</label>
<textarea id="message" name="message" rows="5" required></textarea>
<button type="submit">{_text(messages['submit'])}</button>
</form><p class="form-note">{_text(messages['form_note'])}</p></section>"""


def _render_contact_panel(contact: ContactInfo, messages: Mapping[str, str],
                          locale: str) -> str:
    coords = contact.coordinates
    map_url = build_map_embed_url(coords, contact.map_provider, contact.map_zoom, locale)
    directions = build_directions_url(coords)
    wa_url = build_whatsapp_url(contact.primary_phone, messages["wa_message"])
    tel_url = build_tel_url(contact.secondary_phone)
    primary = format_national(contact.primary_phone)
    secondary = format_national(contact.secondary_phone)
    address = contact.address
    address_line = address.line1 + (f", {address.line2}" if address.line2 else "")
    wa_aria = messages["wa_aria"].format(
        phone=f"{to_e164(contact.primary_phone)} {primary}")
    tel_aria = messages["phone_aria"].format(
        phone=f"{to_e164(contact.secondary_phone)} {secondary}")
    return f"""
<section class="card info-card" aria-labelledby="contact-info-heading">
<h2 id="contact-info-heading">{_text(messages['office_title'])}</h2>
<iframe class="map" src="{_text(map_url)}" title="{_text(messages['map_title'])}"
 loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
<address><p class="address-line">{_text(address_line)}</p>
<p>{_text(address.city)}, {_text(address.state)} {_text(address.postal_code)}</p>
<p>{_text(address.country)}</p>
<a href="{_text(directions)}" target="_blank" rel="noopener noreferrer">{_text(messages['get_directions'])}</a></address>
<div class="contact-links">
<a href="{_text(wa_url)}" target="_blank" rel="noopener noreferrer" aria-label="{_text(wa_aria)}">
<span aria-hidden="true">◉</span> {_text(messages['whatsapp'])}: {_text(primary)}</a>
<a href="{_text(tel_url)}" aria-label="{_text(tel_aria)}">
<span aria-hidden="true">☎</span> {_text(messages['call'])}: {_text(secondary)}</a>
</div></section>"""


def render_page(locale: str = "es", *, submitted: bool = False,
                contact: ContactInfo = CONTACT_INFO) -> str:
    selected = locale if locale in MESSAGES else "es"
    messages = MESSAGES[selected]
    notice = (f'<p class="notice" role="status">{_text(messages["submitted"])}</p>'
              if submitted else "")
    nav = (f'<nav aria-label="{_text(messages["language"])}">'
           '<a href="/es/contact" lang="es">Español</a> · '
           '<a href="/en/contact" lang="en">English</a></nav>')
    return f"""<!doctype html>
<html lang="{_text(selected)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{_text(messages['page_title'])}">
<title>{_text(messages['page_title'])}</title><style>
* {{ box-sizing: border-box; }} body {{ margin: 0; font-family: system-ui,sans-serif; background:#f7f8fa; color:#172033; }}
main {{ width:min(100% - 2rem,72rem); margin:auto; padding:2.5rem 0 4rem; }}
.page-header {{ text-align:center; margin-bottom:2rem; }} .content-grid {{ display:grid; grid-template-columns:minmax(0,1fr); gap:2rem; }}
.card {{ width:100%; min-width:0; padding:1.5rem; border:1px solid #dfe3e9; border-radius:.75rem; background:white; }}
form {{ display:grid; gap:.65rem; }} input,textarea {{ width:100%; padding:.7rem; font:inherit; }}
.map {{ display:block; width:100%; height:16rem; margin-top:1rem; border:0; }} address {{ margin-top:1.25rem; font-style:normal; line-height:1.6; }}
.contact-links {{ display:flex; flex-direction:column; gap:.75rem; margin-top:1.5rem; }}
a:focus-visible,button:focus-visible {{ outline:3px solid #6a9cff; outline-offset:2px; }}
@media (min-width:64rem) {{ .content-grid {{ grid-template-columns:repeat(2,minmax(0,1fr)); }} }}
</style></head><body><main><header class="page-header">
<h1>{_text(messages['page_title'])}</h1>{nav}</header>{notice}<div class="content-grid">
{_render_contact_form(messages)}{_render_contact_panel(contact,messages,selected)}</div></main></body></html>"""


def _read_request_body(environ: Mapping[str, object]) -> bytes:
    try:
        length = int(str(environ.get("CONTENT_LENGTH", "0") or "0"))
    except (TypeError, ValueError):
        length = 0
    stream = environ.get("wsgi.input")
    if length <= 0 or stream is None:
        return b""
    return stream.read(length)  # type: ignore[union-attr]


def application(environ: dict[str, object], start_response) -> list[bytes]:
    path = str(environ.get("PATH_INFO", "/"))
    method = str(environ.get("REQUEST_METHOD", "GET")).upper()
    if path == "/":
        start_response("302 Found", [("Location", "/es/contact"), ("Content-Length", "0")])
        return [b""]
    parts = [part for part in path.strip("/").split("/") if part]
    if len(parts) != 2 or parts[1] != "contact":
        body = b"Not found"
        start_response(f"{HTTPStatus.NOT_FOUND.value} {HTTPStatus.NOT_FOUND.phrase}", [
            ("Content-Type", "text/plain; charset=utf-8"), ("Content-Length", str(len(body)))])
        return [body]
    locale = parts[0] if parts[0] in MESSAGES else "es"
    if method not in {"GET", "HEAD", "POST"}:
        body = b"Method not allowed"
        start_response(f"{HTTPStatus.METHOD_NOT_ALLOWED.value} {HTTPStatus.METHOD_NOT_ALLOWED.phrase}", [
            ("Content-Type", "text/plain; charset=utf-8"), ("Allow", "GET, HEAD, POST"),
            ("Content-Length", str(len(body)))])
        return [body]
    submitted = method == "POST"
    if submitted:
        _read_request_body(environ)  # Se consume; nunca se persiste o refleja.
    body = render_page(locale, submitted=submitted).encode("utf-8")
    headers = [("Content-Type", "text/html; charset=utf-8"),
               ("Content-Length", str(len(body))),
               ("X-Content-Type-Options", "nosniff"),
               ("Referrer-Policy", "strict-origin-when-cross-origin")]
    start_response(f"{HTTPStatus.OK.value} {HTTPStatus.OK.phrase}", headers)
    return [b"" if method == "HEAD" else body]


# ---------------------------------------------------------------------------
# Pruebas unitarias exhaustivas: pytest -q output_modulo.py
# ---------------------------------------------------------------------------
import io  # noqa: E402
import pytest  # noqa: E402
from dataclasses import FrozenInstanceError  # noqa: E402


def _call(path="/es/contact", method="GET", body=b"", length=None):
    env = {"PATH_INFO": path, "REQUEST_METHOD": method,
           "wsgi.input": io.BytesIO(body),
           "CONTENT_LENGTH": str(len(body) if length is None else length)}
    result = {}
    def start_response(status, headers, exc_info=None):
        result["status"], result["headers"] = status, dict(headers)
    chunks = application(env, start_response)
    return result["status"], result["headers"], b"".join(chunks), chunks


class TestDataAndTypes:
    def test_single_source_contact_data(self):
        assert CONTACT_INFO.coordinates == GeoCoordinates(25.761681, -80.191788)
        assert CONTACT_INFO.address.city == "Miami"
        assert CONTACT_INFO.address.line1 == "100 Ocean Drive"
        assert CONTACT_INFO.address.line2 == "Suite 200"
        assert CONTACT_INFO.primary_phone.kind == "whatsapp"
        assert CONTACT_INFO.secondary_phone.kind == "direct"
        assert CONTACT_INFO.map_provider == "google-maps" and CONTACT_INFO.map_zoom == 16
    def test_fictional_numbers_and_shared_area_code(self):
        for phone in (CONTACT_INFO.primary_phone, CONTACT_INFO.secondary_phone):
            assert phone.national_number.startswith("30555501")
            assert len(phone.national_number) == 10
    def test_frozen_data(self):
        with pytest.raises(FrozenInstanceError):
            CONTACT_INFO.address.city = "Orlando"


class TestPhoneUtilities:
    @pytest.mark.parametrize("raw,expected", [
        ("3055550142", "+13055550142"),
        ("(305) 555-0142", "+13055550142"),
        ("305.555.0142x", "+13055550142"),
        # La cifra arábiga se elimina; no se translitera a un 3 ASCII.
        ("٣055550142", "+1055550142"),
        ("abc", "+1"),
    ])
    def test_to_e164_sanitizes(self, raw, expected):
        assert to_e164(ContactPhone("x", "direct", "US", raw)) == expected
    def test_country_code_is_case_insensitive(self):
        assert to_e164(ContactPhone("x", "direct", "us", "3055550142")) == "+13055550142"
    def test_unknown_country_documented_fallback(self):
        assert to_e164(ContactPhone("x", "direct", "ZZ", "123")) == "+123"
    @pytest.mark.parametrize("raw,expected", [
        ("3055550142", "(305) 555-0142"),
        ("(305) 555-0142", "(305) 555-0142"),
        ("13055550142", "13055550142"),
        ("123", "123"), ("12-34", "12-34"),
    ])
    def test_format_national(self, raw, expected):
        assert format_national(ContactPhone("x", "direct", "US", raw)) == expected
    def test_whatsapp_without_message(self):
        assert build_whatsapp_url(CONTACT_INFO.primary_phone) == "https://wa.me/13055550142"
        assert build_whatsapp_url(CONTACT_INFO.primary_phone, "") == "https://wa.me/13055550142"
    def test_whatsapp_encoding_matches_encodeURIComponent(self):
        phone = CONTACT_INFO.primary_phone
        assert build_whatsapp_url(phone, "Hello world") == "https://wa.me/13055550142?text=Hello%20world"
        url = build_whatsapp_url(phone, "¡Hola! a&b=c")
        assert "+" not in url
        assert parse_qs(urlparse(url).query)["text"] == ["¡Hola! a&b=c"]
    def test_tel_links(self):
        assert build_tel_url(CONTACT_INFO.secondary_phone) == "tel:+13055550198"


class TestMapAndDirections:
    def test_google_map_exact_url(self):
        assert build_map_embed_url(CONTACT_INFO.coordinates,"google-maps",16,"es") == (
            "https://www.google.com/maps?q=25.761681,-80.191788&hl=es&z=16&output=embed")
    def test_google_map_preserves_comma_encodes_locale_and_has_no_key(self):
        url = build_map_embed_url(GeoCoordinates(1.5,2.5),"google-maps",9,"en US")
        assert "q=1.5,2.5" in url and "hl=en%20US" in url
        assert "key=" not in url and "%2C" not in url
    def test_openstreetmap_bbox_marker_and_provider(self):
        coords = CONTACT_INFO.coordinates
        url = build_map_embed_url(coords,"openstreetmap",16,"es")
        parsed = urlparse(url)
        assert parsed.scheme == "https" and parsed.netloc == "www.openstreetmap.org"
        params = parse_qs(parsed.query)
        assert parsed.path == "/export/embed.html" and params["layer"] == ["mapnik"]
        assert tuple(map(float,params["marker"][0].split(","))) == (coords.lat,coords.lng)
        west,south,east,north = map(float,params["bbox"][0].split(","))
        assert west == pytest.approx(coords.lng-.01) and east == pytest.approx(coords.lng+.01)
        assert south == pytest.approx(coords.lat-.01) and north == pytest.approx(coords.lat+.01)
        assert west < coords.lng < east and south < coords.lat < north
    def test_unsupported_map_provider_fails(self):
        with pytest.raises(ValueError, match="no soportado"):
            build_map_embed_url(CONTACT_INFO.coordinates,"bing",16,"es")
    def test_directions(self):
        assert build_directions_url(CONTACT_INFO.coordinates) == (
            "https://www.google.com/maps/dir/?api=1&destination=25.761681,-80.191788")
        assert "destination=-1.0,-2.0" in build_directions_url(GeoCoordinates(-1,-2))


class TestRendering:
    def test_locale_and_fallback(self):
        assert '<html lang="es">' in render_page()
        assert "Contact us" in render_page("en")
        assert '<html lang="es">' in render_page("fr")
    def test_map_accessibility_address_and_directions(self):
        html = render_page()
        assert "<iframe" in html and 'loading="lazy"' in html
        assert 'referrerpolicy="no-referrer-when-downgrade"' in html
        assert 'title="Mapa de la oficina en Miami, Florida, Estados Unidos"' in html
        assert "<address>" in html and "100 Ocean Drive, Suite 200" in html
        assert "Miami, FL" in html and "33139" in html and "Cómo llegar" in html
    def test_contact_links_and_a11y(self):
        html = render_page()
        assert "https://wa.me/13055550142?text=" in html
        assert 'href="tel:+13055550198"' in html
        assert 'target="_blank"' in html and 'rel="noopener noreferrer"' in html
        assert "vía WhatsApp Web" in html and "Llamar al" in html
        assert "(305) 555-0142" in html and "(305) 555-0198" in html
    def test_form_navigation_and_responsive_layout(self):
        html = render_page()
        for field in ("name", "email", "message"):
            assert f'name="{field}"' in html
        assert 'href="/es/contact"' in html and 'href="/en/contact"' in html
        assert "min-width:64rem" in html and "repeat(2,minmax(0,1fr))" in html
    def test_submitted_notice(self):
        assert 'role="status"' not in render_page()
        assert 'role="status"' in render_page(submitted=True)
        assert "no se envió" in render_page(submitted=True)
    def test_html_escaping_prevents_injection(self):
        assert _text('<script a="b">') == "&lt;script a=&quot;b&quot;&gt;"
        malicious = ContactInfo(CONTACT_INFO.coordinates,
            PostalAddress('<img src=x onerror=1>',"Miami","FL","33139","US"),
            CONTACT_INFO.primary_phone,CONTACT_INFO.secondary_phone,"google-maps",16)
        html = render_page(contact=malicious)
        assert "<img src=x" not in html and "&lt;img" in html
    def test_custom_contact_data_flows_to_page(self):
        custom = ContactInfo(GeoCoordinates(1,2),PostalAddress("Test St","Town","TS","00000","Testland"),
            ContactPhone("p","whatsapp","US","3055550100"),
            ContactPhone("s","direct","US","3055550101"),"openstreetmap",8)
        html = render_page(contact=custom)
        assert "Test St" in html and "openstreetmap.org/export/embed.html" in html
        assert "wa.me/13055550100" in html and "tel:+13055550101" in html


class TestWSGI:
    def test_root_redirect(self):
        status,headers,body,_ = _call("/")
        assert status.startswith("302") and headers["Location"] == "/es/contact"
        assert body == b"" and headers["Content-Length"] == "0"
    @pytest.mark.parametrize("path", ["/es","/es/about","/es/contact/extra"])
    def test_invalid_paths(self,path):
        status,_,body,_ = _call(path)
        assert status.startswith("404") and body == b"Not found"
    @pytest.mark.parametrize("path,text", [("/es/contact","Contáctanos"),
        ("/en/contact","Contact us"),("/fr/contact","Contáctanos")])
    def test_locales_and_headers(self,path,text):
        status,headers,body,chunks = _call(path)
        assert status.startswith("200") and text in body.decode("utf-8")
        assert headers["Content-Type"] == "text/html; charset=utf-8"
        assert headers["X-Content-Type-Options"] == "nosniff"
        assert headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert all(isinstance(chunk,bytes) for chunk in chunks)
    def test_trailing_slash(self):
        assert _call("/es/contact/")[0].startswith("200")
    def test_head_has_empty_body_and_representation_length(self):
        status,headers,body,_ = _call(method="HEAD")
        assert status.startswith("200") and body == b""
        assert int(headers["Content-Length"]) > 0
    def test_post_shows_notice_and_does_not_echo_payload(self):
        payload = b"name=<script>alert(1)</script>"
        status,_,body,_ = _call(method="POST",body=payload)
        text = body.decode("utf-8")
        assert status.startswith("200") and 'role="status"' in text
        assert "alert(1)" not in text
    def test_disallowed_method(self):
        status,headers,body,_ = _call(method="DELETE")
        assert status.startswith("405") and headers["Allow"] == "GET, HEAD, POST"
        assert body == b"Method not allowed"
    def test_post_consumes_body(self):
        stream = io.BytesIO(b"abc")
        env = {"PATH_INFO":"/es/contact","REQUEST_METHOD":"POST",
               "CONTENT_LENGTH":"3","wsgi.input":stream}
        application(env,lambda *args,**kwargs:None)
        assert stream.read() == b""
    def test_missing_environ_defaults(self):
        captured = {}
        application({},lambda status,headers,exc_info=None:captured.update(status=status))
        assert captured["status"].startswith("302")
        captured.clear()
        application({"PATH_INFO":"/es/contact"},
                    lambda status,headers,exc_info=None:captured.update(status=status))
        assert captured["status"].startswith("200")


if __name__ == "__main__":  # pragma: no cover
    with make_server("127.0.0.1",8000,application) as server:
        print("Servidor disponible en http://127.0.0.1:8000/es/contact")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido.")
