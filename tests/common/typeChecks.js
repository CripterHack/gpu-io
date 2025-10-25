// Temporary TypeChecks object for testing compatibility
// This provides the type checking functions that were previously available from @amandaghassaei/type-checks

window.TypeChecks = {
    isNumber: function(value) {
        return !Number.isNaN(value) && typeof value === 'number';
    },
    
    isFiniteNumber: function(value) {
        return window.TypeChecks.isNumber(value) && Number.isFinite(value);
    },
    
    isInteger: function(value) {
        return window.TypeChecks.isFiniteNumber(value) && (value % 1 === 0);
    },
    
    isPositiveInteger: function(value) {
        return window.TypeChecks.isInteger(value) && value > 0;
    },
    
    isNonNegativeInteger: function(value) {
        return window.TypeChecks.isInteger(value) && value >= 0;
    },
    
    isString: function(value) {
        return typeof value === 'string';
    },
    
    isTypedArray: function(value) {
        return ArrayBuffer.isView(value) && !(value instanceof DataView);
    },
    
    isArray: function(value) {
        return Array.isArray(value) || window.TypeChecks.isTypedArray(value);
    },
    
    isObject: function(value) {
        return typeof value === 'object' && !window.TypeChecks.isArray(value) && value !== null && !(value instanceof ArrayBuffer) && !(value instanceof DataView);
    },
    
    isBoolean: function(value) {
        return typeof value === 'boolean';
    }
};