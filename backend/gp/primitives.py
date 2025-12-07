"""Primitive set definitions for genetic programming with robust protected operations."""
import operator
import math
import random
import numpy as np
from deap import gp
from typing import List
import logging

logger = logging.getLogger(__name__)


# ============================================
# Protected Operations (Scalar versions)
# These handle edge cases to prevent NaN/Inf
# ============================================

def protected_div(left, right):
    """Protected division - returns 1.0 when dividing by near-zero."""
    try:
        if abs(right) < 1e-10:
            return 1.0
        result = left / right
        if math.isinf(result) or math.isnan(result):
            return 1.0
        return result
    except:
        return 1.0


def protected_log(x):
    """Protected natural logarithm - handles non-positive values."""
    try:
        if x <= 0:
            return 0.0
        result = math.log(x)
        if math.isinf(result) or math.isnan(result):
            return 0.0
        return result
    except:
        return 0.0


def protected_sqrt(x):
    """Protected square root - uses absolute value."""
    try:
        result = math.sqrt(abs(x))
        if math.isinf(result) or math.isnan(result):
            return 0.0
        return result
    except:
        return 0.0


def protected_pow(base, exp):
    """Protected power function - clamps exponent and handles edge cases."""
    try:
        # Clamp exponent to reasonable range
        exp = max(-5, min(5, exp))
        
        # Use abs(base) to avoid complex numbers
        abs_base = abs(base) + 1e-10
        result = math.pow(abs_base, exp)
        
        if math.isinf(result) or math.isnan(result) or abs(result) > 1e10:
            return 1.0
        return result
    except:
        return 1.0


def protected_exp(x):
    """Protected exponential - clamps input to avoid overflow."""
    try:
        # Clamp input to prevent overflow
        x_clamped = max(-30, min(30, x))
        result = math.exp(x_clamped)
        if math.isinf(result) or math.isnan(result):
            return 1.0
        return result
    except:
        return 1.0


def protected_tan(x):
    """Protected tangent - handles asymptotes."""
    try:
        result = math.tan(x)
        if math.isinf(result) or math.isnan(result) or abs(result) > 1e10:
            return 0.0
        return result
    except:
        return 0.0


def protected_sin(x):
    """Protected sine."""
    try:
        result = math.sin(x)
        if math.isnan(result):
            return 0.0
        return result
    except:
        return 0.0


def protected_cos(x):
    """Protected cosine."""
    try:
        result = math.cos(x)
        if math.isnan(result):
            return 0.0
        return result
    except:
        return 0.0


def safe_add(a, b):
    """Safe addition with overflow protection."""
    try:
        result = a + b
        if math.isinf(result) or math.isnan(result):
            return 0.0
        return result
    except:
        return 0.0


def safe_sub(a, b):
    """Safe subtraction with overflow protection."""
    try:
        result = a - b
        if math.isinf(result) or math.isnan(result):
            return 0.0
        return result
    except:
        return 0.0


def safe_mul(a, b):
    """Safe multiplication with overflow protection."""
    try:
        result = a * b
        if math.isinf(result) or math.isnan(result) or abs(result) > 1e10:
            return 0.0
        return result
    except:
        return 0.0


# ============================================
# Ephemeral Constant Generator
# ============================================

def generate_random_constant():
    """Generate a random constant for ephemeral terminals."""
    return round(random.uniform(-3, 3), 2)


# ============================================
# Operator Mappings
# ============================================

OPERATOR_MAP = {
    "+": (safe_add, 2, "add"),
    "-": (safe_sub, 2, "sub"),
    "*": (safe_mul, 2, "mul"),
    "/": (protected_div, 2, "div"),
    "^": (protected_pow, 2, "pow"),
}

FUNCTION_MAP = {
    "sin": (protected_sin, 1, "sin"),
    "cos": (protected_cos, 1, "cos"),
    "tan": (protected_tan, 1, "tan"),
    "sqrt": (protected_sqrt, 1, "sqrt"),
    "log": (protected_log, 1, "log"),
    "exp": (protected_exp, 1, "exp"),
    "abs": (abs, 1, "abs"),
}


# ============================================
# Primitive Set Creation
# ============================================

def create_primitive_set(
    num_variables: int,
    variable_names: List[str],
    operators: List[str],
    functions: List[str]
) -> gp.PrimitiveSet:
    """
    Create a DEAP primitive set with the specified operators and functions.
    
    All operations are protected against NaN/Inf values.
    """
    logger.info(f"Creating primitive set: {num_variables} vars, names={variable_names}")
    
    pset = gp.PrimitiveSet("MAIN", num_variables)
    
    # Rename arguments to match variable names
    for i, name in enumerate(variable_names):
        safe_name = ''.join(c if c.isalnum() or c == '_' else '_' for c in name)
        if safe_name and safe_name[0].isdigit():
            safe_name = 'x' + safe_name
        if not safe_name:
            safe_name = f'x{i}'
        
        logger.info(f"Renaming ARG{i} to {safe_name}")
        pset.renameArguments(**{f"ARG{i}": safe_name})
    
    # Add operators
    for op in operators:
        if op in OPERATOR_MAP:
            func, arity, name = OPERATOR_MAP[op]
            logger.info(f"Adding operator: {name} ({op})")
            pset.addPrimitive(func, arity, name=name)
    
    # Add functions
    for func_name in functions:
        if func_name in FUNCTION_MAP:
            func, arity, name = FUNCTION_MAP[func_name]
            logger.info(f"Adding function: {name}")
            pset.addPrimitive(func, arity, name=name)
    
    # Add ephemeral random constant
    pset.addEphemeralConstant("ERC", generate_random_constant)
    logger.info("Added ephemeral random constant")
    
    logger.info(f"Primitive set created with {len(pset.primitives[object])} primitives")
    
    return pset


def expr_to_string(expr, pset) -> str:
    """Convert a DEAP expression tree to a readable string."""
    return str(expr)
