"""Checks for the optional Python edition (python/stepsheet).

Run from the repo root:  python -m unittest -v tests.test_python
The .soe checks need only Python 3.8+. The PDF checks need reportlab and pillow
(pip install -r python/requirements.txt) and are skipped without them.
"""
import io, os, re, sys, tempfile, unittest
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "python"))
FIXTURE = os.path.join(ROOT, "tests", "fixtures", "sample.soe")

from stepsheet.soe import Document  # noqa: E402

try:
    import reportlab, PIL  # noqa: F401
    HAVE_PDF = True
except ImportError:
    HAVE_PDF = False


def read(path):
    with open(path, "rb") as f:
        return f.read()


def flat(xml_bytes):
    """Sorted 'path | attributes | text' lines for every element (photos as <photo>)."""
    out = []
    def walk(el, path):
        for c in el:
            p = path + "/" + ("<photo>" if path.endswith("/images") else c.tag)
            txt = "" if len(c) else re.sub(r"\s+", "" if path.endswith("/images") else " ", c.text or "").strip()
            out.append(f"{p} | {','.join(f'{k}={v}' for k, v in sorted(c.attrib.items()))} | {txt}")
            walk(c, p)
    root = ET.fromstring(xml_bytes)
    walk(root, root.tag)
    return sorted(out)


class SoeFiles(unittest.TestCase):
    def setUp(self):
        self.raw = read(FIXTURE)
        self.doc = Document.load(self.raw)

    def test_reads_sample(self):
        d = self.doc
        self.assertEqual(len(d.tasks), 4)
        self.assertEqual(d.header["udc1"], "SAMPLE RAIL INSTALL")
        self.assertEqual(d.tasks[1].code, "ABYC H-24")
        self.assertTrue(d.tasks[2].quality)
        self.assertEqual(len(d.images), 2)

    def test_save_keeps_everything(self):
        self.assertEqual(flat(self.raw), flat(self.doc.to_xml()))

    def test_unknown_tags_kept_in_place(self):
        out = self.doc.to_xml().decode("iso-8859-1")
        self.assertIn('<ExampleApprover role="QA">', out)
        self.assertIn("</imageroot><ExampleTrailer>", out)
        self.assertIn("<ExampleNote>", out)

    def test_second_save_identical(self):
        once = self.doc.to_xml()
        self.assertEqual(once, Document.load(once).to_xml())

    def test_pdf_file_names_match_app(self):
        from stepsheet.__main__ import pdf_file_name
        d = self.doc
        self.assertEqual(os.path.basename(pdf_file_name(d, FIXTURE)), "000123 SAMPLE RAIL INSTALL.pdf")
        self.assertEqual(os.path.basename(pdf_file_name(d, FIXTURE, lang="es")), "000123 INSTALACION DE RIEL DE MUESTRA (Español).pdf")
        self.assertEqual(os.path.basename(pdf_file_name(d, FIXTURE, soe=True)), "000123 SAMPLE RAIL INSTALL Analysis.pdf")


@unittest.skipUnless(HAVE_PDF, "reportlab / pillow not installed")
class Pdfs(unittest.TestCase):
    def test_instructions_and_analysis_pdfs(self):
        from stepsheet import pdf_export as pe
        d = Document.load(read(FIXTURE))
        with tempfile.TemporaryDirectory() as tmp:
            a, b = os.path.join(tmp, "a.pdf"), os.path.join(tmp, "b.pdf")
            pe.build_instructions_pdf(d, a)
            pe.build_soe_pdf(d, b)
            for f in (a, b):
                data = read(f)
                self.assertTrue(data.startswith(b"%PDF-") and len(data) > 1000, f)


if __name__ == "__main__":
    unittest.main()
