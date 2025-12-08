"""
Equation Formatter using SymPy.

Converts DEAP functional expressions to simplified mathematical notation
and LaTeX format for human-readable display.
"""
import re
import sympy as sp
from sympy import symbols, simplify, factor, latex, nsimplify
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# Define common symbols
x, y, z = symbols('x y z')


def _tokenize_deap_expr(expr_str: str) -> str:
    """
    Convert DEAP functional notation to infix notation.
    
    DEAP expressions look like: add(mul(x, 2.5), sub(x, 1))
    We need to convert to: ((x * 2.5) + (x - 1))
    """
    # Replace protected/safe function names with standard ones
    replacements = [
        ('protected_div', 'div'),
        ('protected_log', 'log'),
        ('protected_sqrt', 'sqrt'),
        ('protected_pow', 'pow'),
        ('protected_exp', 'exp'),
        ('protected_sin', 'sin'),
        ('protected_cos', 'cos'),
        ('protected_tan', 'tan'),
        ('safe_add', 'add'),
        ('safe_sub', 'sub'),
        ('safe_mul', 'mul'),
    ]
    
    result = expr_str
    for old, new in replacements:
        result = result.replace(old, new)
    
    return result


def _parse_functional_to_infix(expr_str: str) -> str:
    """
    Recursively parse functional notation to infix notation.
    
    add(a, b) -> (a + b)
    mul(a, b) -> (a * b)
    sub(a, b) -> (a - b)
    div(a, b) -> (a / b)
    pow(a, b) -> (a ** b)
    """
    expr_str = expr_str.strip()
    
    # Binary operators
    binary_ops = {
        'add': '+',
        'sub': '-',
        'mul': '*',
        'div': '/',
        'pow': '**',
    }
    
    # Unary functions (keep as-is for SymPy)
    unary_funcs = {'sin', 'cos', 'tan', 'sqrt', 'log', 'exp', 'abs'}
    
    # Check if it's a function call
    match = re.match(r'^(\w+)\((.*)\)$', expr_str)
    
    if not match:
        # It's a terminal (variable or constant)
        return expr_str
    
    func_name = match.group(1)
    args_str = match.group(2)
    
    # Parse arguments (handle nested parentheses)
    args = _split_arguments(args_str)
    
    if func_name in binary_ops and len(args) == 2:
        # Binary operator
        left = _parse_functional_to_infix(args[0])
        right = _parse_functional_to_infix(args[1])
        return f"({left} {binary_ops[func_name]} {right})"
    
    elif func_name in unary_funcs and len(args) == 1:
        # Unary function
        arg = _parse_functional_to_infix(args[0])
        return f"{func_name}({arg})"
    
    else:
        # Unknown function, try to handle generically
        parsed_args = [_parse_functional_to_infix(arg) for arg in args]
        return f"{func_name}({', '.join(parsed_args)})"


def _split_arguments(args_str: str) -> list:
    """
    Split function arguments respecting nested parentheses.
    
    "a, b" -> ["a", "b"]
    "add(x, y), z" -> ["add(x, y)", "z"]
    """
    args = []
    current = []
    depth = 0
    
    for char in args_str:
        if char == '(':
            depth += 1
            current.append(char)
        elif char == ')':
            depth -= 1
            current.append(char)
        elif char == ',' and depth == 0:
            args.append(''.join(current).strip())
            current = []
        else:
            current.append(char)
    
    if current:
        args.append(''.join(current).strip())
    
    return args


def _extract_variable_names(expr_str: str) -> set:
    """
    Extract variable names from a DEAP expression.

    Returns set of variable names found in the expression.
    """
    # Remove known function names and operators
    known_funcs = {'add', 'sub', 'mul', 'div', 'pow', 'sin', 'cos', 'tan',
                   'sqrt', 'log', 'exp', 'abs', 'protected_div', 'protected_log',
                   'protected_sqrt', 'protected_pow', 'protected_exp',
                   'protected_sin', 'protected_cos', 'protected_tan',
                   'safe_add', 'safe_sub', 'safe_mul'}

    # Find all word tokens
    tokens = re.findall(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\b', expr_str)

    # Filter out functions
    variables = set()
    for token in tokens:
        if token.lower() not in known_funcs:
            variables.add(token)

    return variables


def deap_to_sympy(expr_str: str) -> Optional[sp.Expr]:
    """
    Convert a DEAP expression string to a SymPy expression.

    Args:
        expr_str: DEAP functional expression like "add(mul(x, 2), x)"

    Returns:
        SymPy expression or None if parsing fails
    """
    try:
        # Clean up the expression
        cleaned = _tokenize_deap_expr(expr_str)

        # Convert functional to infix notation
        infix = _parse_functional_to_infix(cleaned)

        # Parse with SymPy
        # Define local symbols that might appear
        local_dict = {
            'x': x, 'y': y, 'z': z,
            'sin': sp.sin, 'cos': sp.cos, 'tan': sp.tan,
            'sqrt': sp.sqrt, 'log': sp.log, 'exp': sp.exp,
            'abs': sp.Abs,
        }

        # Add x0, x1, x2... as symbols
        for i in range(10):
            local_dict[f'x{i}'] = symbols(f'x_{i}')
            local_dict[f'ARG{i}'] = symbols(f'x_{i}')

        # Dynamically add any variable names found in the expression
        var_names = _extract_variable_names(expr_str)
        for var_name in var_names:
            if var_name not in local_dict:
                local_dict[var_name] = symbols(var_name)

        transformations = standard_transformations + (implicit_multiplication,)

        sympy_expr = parse_expr(infix, local_dict=local_dict,
                                transformations=transformations)

        return sympy_expr

    except Exception as e:
        logger.warning(f"Failed to parse expression '{expr_str}': {e}")
        return None


def simplify_equation(expr_str: str) -> Dict[str, Any]:
    """
    Convert a DEAP expression to simplified form and LaTeX.
    
    Args:
        expr_str: DEAP functional expression
        
    Returns:
        Dictionary with:
        - original: Original DEAP expression
        - simplified: Simplified expression as string
        - latex: LaTeX representation
        - success: Whether parsing succeeded
    """
    result = {
        "original": expr_str,
        "simplified": expr_str,
        "latex": expr_str,
        "success": False
    }
    
    try:
        # Parse to SymPy
        sympy_expr = deap_to_sympy(expr_str)
        
        if sympy_expr is None:
            return result
        
        # Try to simplify
        try:
            # First try to rationalize floating point numbers
            simplified = nsimplify(sympy_expr, rational=False, tolerance=0.01)
            
            # Then simplify algebraically
            simplified = simplify(simplified)
            
            # Try factoring if it makes it simpler
            factored = factor(simplified)
            if len(str(factored)) < len(str(simplified)):
                simplified = factored
                
        except Exception:
            simplified = sympy_expr
        
        # Generate LaTeX
        latex_str = latex(simplified)
        
        # Clean up LaTeX for better display
        latex_str = _clean_latex(latex_str)
        
        result["simplified"] = str(simplified)
        result["latex"] = latex_str
        result["success"] = True
        
    except Exception as e:
        logger.warning(f"Failed to simplify equation: {e}")
    
    return result


def _clean_latex(latex_str: str) -> str:
    """
    Clean up LaTeX for better display.
    """
    # Replace some verbose LaTeX constructs
    latex_str = latex_str.replace(r'\operatorname{log}', r'\ln')
    
    # Simplify multiplication signs where not needed
    latex_str = re.sub(r'(\d)\s*\\cdot\s*([a-z])', r'\1\2', latex_str)
    
    return latex_str


def format_for_display(expr_str: str) -> str:
    """
    Format equation for simple text display (no LaTeX).
    
    Converts DEAP functional notation to readable infix.
    """
    try:
        sympy_expr = deap_to_sympy(expr_str)
        if sympy_expr is not None:
            simplified = simplify(sympy_expr)
            return str(simplified)
    except Exception:
        pass
    
    # Fallback: basic string replacement
    return _basic_format(expr_str)


def _basic_format(expr_str: str) -> str:
    """
    Basic formatting without SymPy (fallback).
    """
    result = expr_str
    replacements = [
        ('add(', '('),
        ('sub(', '('),
        ('mul(', '('),
        ('div(', '('),
        ('protected_', ''),
        ('safe_', ''),
    ]
    for old, new in replacements:
        result = result.replace(old, new)
    return result

