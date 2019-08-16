"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
class SmogonStats {
    constructor() {
        this.leads = [];
    }
    getLeads(format = 'gen7ou') {
        if (!this.leads[format]) {
            const data = this.loadFileData('leads', format);
            this.leads[format] = data.data.rows.slice(0, 10);
        }
        return this.leads[format].map(mon => { return { name: mon[1], usage: mon[2] }; });
    }
    loadFileData(statsType, format = '') {
        const rawdata = fs.readFileSync(`data/smogon-stats/${statsType}-${format}.json`).toString();
        return JSON.parse(rawdata);
    }
}
exports.SmogonStats = SmogonStats;
//module.exports = SmogonStats
//# sourceMappingURL=smogonStats.js.map