# csv-sniff

Before you split on comma: what is this file, really? Returns the delimiter (`,` `;` tab `|`), the quote character, the line ending, whether the first row is a header, a confidence 0–1, and the reasons behind each call. Treat anything under 0.6 as "ask the user".

```js
import { sniffCsv } from "csv-sniff";
sniffCsv("artikel;preis\nSchraube;1,25\n");
// { delimiter: ";", quote: '"', lineEnding: "\n", hasHeader: true, confidence: 0.7, reasons: [...] }
```

Counts delimiters outside quotes, so `"hello, world"` does not fool it. Zero dependencies. Node 18+. MIT.
