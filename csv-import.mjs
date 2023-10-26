import fs from 'fs';
import readline from 'readline';

export default class CsvImport {
  constructor(filePath) {
    this.filePath = filePath;
    this.headers = [];
    this.parsedData = [];
  }

  async init() {
      const fileStream = fs.createReadStream(this.filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity // to handle all instances of CR LF ('\r\n') in input.txt as a single line break
      });

      let isFirstLine = true;
      for await (const line of rl) {
        const row = this.parseCsvLine(line);
        if (isFirstLine) {
          this.headers = row;
          isFirstLine = false;
        } else {
          this.parsedData.push(row);
        }
      }
  }

  parseCsvLine(line) {
      const row = [];
      let start = 0;
      let inQuote = false;
      for (let end = 0; end < line.length; end++) {
        if (line[end] === '"') {
          inQuote = !inQuote;
        }
        if ((line[end] === ',' && !inQuote) || end === line.length - 1) {
          let value = line.substring(start, end).trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
            value = value.replace(/""/g, '"'); // handles escaped quotes
          }
          row.push(value);
          start = end + 1;
        }
      }
      return row;
  }

  getRow(rowIndex) {
    return rowIndex < this.parsedData.length ? this.parsedData[rowIndex] : null;
  }

  getColumn(columnIndex) {
    const column = [];
    for (let row of this.parsedData) {
      column.push(row[columnIndex]);
    }
    return column;
  }

  getColumnByName(name) {
    const columnIndex = this.headers.findIndex(header => header.toLowerCase() === name.toLowerCase());
    
    if (columnIndex === -1) {
      console.error(`Column name "${name}" not found in headers.`);
      return null;
    }
    return this.getColumn(columnIndex);
  }

  async updateAndSaveRow(url, updatedData) {
    const rowIndex = this.parsedData.findIndex(row => row.includes(url));
    if (rowIndex === -1) {
      console.warn(`URL not found in CSV data: ${url}`);
      return;
    }

    const row = this.parsedData[rowIndex];
    
    row.push(updatedData.emails, updatedData.socialMedia, updatedData.blockedByCloudflare); // or however you wish to structure it
    this.parsedData[rowIndex] = row;

    await this.saveToFile(); // Save the data after each update
  }

  async saveToFile() {
    const csvString = this.headers.toString() + ',\n' + this.parsedData.map(row => row.join(',')).join('\n');
    await fs.promises.writeFile(this.filePath, csvString, 'utf-8');
  }



}
