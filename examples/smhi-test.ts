import { svedata } from "@svedata/data";

const result = await svedata.smhi.current("Malmö");
console.log(JSON.stringify(result, null, 2));
