/**
 * Utility functions for AI service
 */

/**
 * Convert data matrix to celldata (only non-empty cells)
 * @param {Array<Array>} data - 2D array of cells (can contain null for empty cells)
 * @returns {Array} List of {r, c, v} objects for non-empty cells
 */
function dataToCelldata(data) {
  const celldata = [];
  if (!data) {
    return celldata;
  }

  for (let r = 0; r < data.length; r += 1) {
    if (!data[r]) {
      continue;
    }
    for (let c = 0; c < data[r].length; c += 1) {
      const cell = data[r][c];
      if (cell != null) {
        celldata.push({
          r: r,
          c: c,
          v: cell,
        });
      }
    }
  }

  return celldata;
}

module.exports = {
  dataToCelldata,
};

