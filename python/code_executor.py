"""
Code Executor Service
Executes code in Python, Java, C, and C++ with security measures
"""
import subprocess
import sys
import os
import tempfile
import shutil
from typing import Dict, Optional
import time

class CodeExecutor:
    """Secure code execution with timeout and resource limits"""
    
    TIMEOUT = 10  # seconds
    
    @staticmethod
    def execute_python(code: str, input_data: str = "") -> Dict:
        """Execute Python code"""
        try:
            start_time = time.time()
            result = subprocess.run(
                [sys.executable, "-c", code],
                input=input_data,
                capture_output=True,
                text=True,
                timeout=CodeExecutor.TIMEOUT
            )
            execution_time = time.time() - start_time
            
            return {
                "success": result.returncode == 0,
                "output": result.stdout,
                "error": result.stderr if result.stderr else None,
                "executionTime": round(execution_time, 3)
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "output": "",
                "error": f"Execution timeout ({CodeExecutor.TIMEOUT}s limit exceeded)",
                "executionTime": CodeExecutor.TIMEOUT
            }
        except Exception as e:
            return {
                "success": False,
                "output": "",
                "error": str(e),
                "executionTime": 0
            }
    
    @staticmethod
    def execute_java(code: str, input_data: str = "") -> Dict:
        """Execute Java code"""
        temp_dir = None
        try:
            # Create temporary directory
            temp_dir = tempfile.mkdtemp()
            
            # Extract class name from code
            class_name = "Main"
            if "public class " in code:
                class_name = code.split("public class ")[1].split()[0].split("{")[0]
            
            # Write code to file
            java_file = os.path.join(temp_dir, f"{class_name}.java")
            with open(java_file, 'w') as f:
                f.write(code)
            
            # Compile
            start_time = time.time()
            compile_result = subprocess.run(
                ["javac", java_file],
                capture_output=True,
                text=True,
                timeout=CodeExecutor.TIMEOUT
            )
            
            if compile_result.returncode != 0:
                return {
                    "success": False,
                    "output": "",
                    "error": f"Compilation Error:\n{compile_result.stderr}",
                    "executionTime": 0
                }
            
            # Execute
            run_result = subprocess.run(
                ["java", "-cp", temp_dir, class_name],
                input=input_data,
                capture_output=True,
                text=True,
                timeout=CodeExecutor.TIMEOUT
            )
            execution_time = time.time() - start_time
            
            return {
                "success": run_result.returncode == 0,
                "output": run_result.stdout,
                "error": run_result.stderr if run_result.stderr else None,
                "executionTime": round(execution_time, 3)
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "output": "",
                "error": f"Execution timeout ({CodeExecutor.TIMEOUT}s limit exceeded)",
                "executionTime": CodeExecutor.TIMEOUT
            }
        except FileNotFoundError:
            return {
                "success": False,
                "output": "",
                "error": "Java compiler (javac) not found. Please install JDK.",
                "executionTime": 0
            }
        except Exception as e:
            return {
                "success": False,
                "output": "",
                "error": str(e),
                "executionTime": 0
            }
        finally:
            # Cleanup
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
    
    @staticmethod
    def execute_c_cpp(code: str, input_data: str = "", language: str = "c") -> Dict:
        """Execute C or C++ code"""
        temp_dir = None
        try:
            # Create temporary directory
            temp_dir = tempfile.mkdtemp()
            
            # File extensions
            ext = ".c" if language == "c" else ".cpp"
            compiler = "gcc" if language == "c" else "g++"
            
            # Write code to file
            source_file = os.path.join(temp_dir, f"main{ext}")
            output_file = os.path.join(temp_dir, "program.exe" if os.name == 'nt' else "program")
            
            with open(source_file, 'w') as f:
                f.write(code)
            
            # Compile
            start_time = time.time()
            compile_result = subprocess.run(
                [compiler, source_file, "-o", output_file],
                capture_output=True,
                text=True,
                timeout=CodeExecutor.TIMEOUT
            )
            
            if compile_result.returncode != 0:
                return {
                    "success": False,
                    "output": "",
                    "error": f"Compilation Error:\n{compile_result.stderr}",
                    "executionTime": 0
                }
            
            # Execute
            run_result = subprocess.run(
                [output_file],
                input=input_data,
                capture_output=True,
                text=True,
                timeout=CodeExecutor.TIMEOUT
            )
            execution_time = time.time() - start_time
            
            return {
                "success": run_result.returncode == 0,
                "output": run_result.stdout,
                "error": run_result.stderr if run_result.stderr else None,
                "executionTime": round(execution_time, 3)
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "output": "",
                "error": f"Execution timeout ({CodeExecutor.TIMEOUT}s limit exceeded)",
                "executionTime": CodeExecutor.TIMEOUT
            }
        except FileNotFoundError:
            return {
                "success": False,
                "output": "",
                "error": f"{compiler.upper()} compiler not found. Please install GCC/G++.",
                "executionTime": 0
            }
        except Exception as e:
            return {
                "success": False,
                "output": "",
                "error": str(e),
                "executionTime": 0
            }
        finally:
            # Cleanup
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
    
    @staticmethod
    def execute(language: str, code: str, input_data: str = "") -> Dict:
        """Main execution method - routes to appropriate executor"""
        language = language.lower()
        
        if language == "python":
            return CodeExecutor.execute_python(code, input_data)
        elif language == "java":
            return CodeExecutor.execute_java(code, input_data)
        elif language in ["c", "cpp", "c++"]:
            lang = "c" if language == "c" else "cpp"
            return CodeExecutor.execute_c_cpp(code, input_data, lang)
        else:
            return {
                "success": False,
                "output": "",
                "error": f"Unsupported language: {language}",
                "executionTime": 0
            }
