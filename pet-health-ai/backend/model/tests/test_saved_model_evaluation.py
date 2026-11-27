"""Real local checkpoints, synthetic images: integration checks, not disease accuracy."""

import ast
import contextlib
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import torch

from model.saved_model_evaluation import (
    LEGACY_CLASS_NAMES, SavedModelEvaluation, legacy_file_hash, legacy_make_views,
    legacy_prepare_dataset,
)


ROOT = Path(__file__).resolve().parents[2]


class SavedCheckpointEvaluationTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)
        self.temp = tempfile.TemporaryDirectory()
        self.project = Path(self.temp.name)
        self.work = self.project / "work"
        self.original_hashes = {}
        self.source_paths = {
            "mobilenet_model.pth": (ROOT / "model" / "mobilenet" / "mobilenet_model.pth")
            if (ROOT / "model" / "mobilenet" / "mobilenet_model.pth").exists()
            else (ROOT / "model" / "mobilenet_model.pth"),
            "efficientnet_model.pth": (ROOT / "model" / "b0" / "efficientnet_model.pth")
            if (ROOT / "model" / "b0" / "efficientnet_model.pth").exists()
            else (ROOT / "model" / "efficientnet_model.pth"),
        }
        for name, source in self.source_paths.items():
            self.original_hashes[name] = legacy_file_hash(source)
            shutil.copy2(source, self.project / name)
        rows = []
        with zipfile.ZipFile(self.project / "dog_skin_dataset.zip", "w") as archive:
            for split_index, split in enumerate(["train", "val", "test"]):
                for index, name in enumerate(LEGACY_CLASS_NAMES):
                    image = Image.new("RGB", (80, 90), (20+index*20,40+split_index*35,70+index*10))
                    image.paste((210,30+index,60+split_index),(0,0,20,90))
                    content = io.BytesIO()
                    image.save(content,format="PNG")
                    raw = content.getvalue()
                    member=f"dog_skin_dataset/{name}/{split}.png"
                    archive.writestr(member,raw)
                    import hashlib
                    rows.append({"zip_path":member,"class":name,"md5":hashlib.md5(raw).hexdigest(),
                                 "group6":f"{split}_{index}","split":split})
            self.frame=pd.DataFrame(rows)
            archive.writestr("dog_skin_dataset/manifest.csv",self.frame.drop(columns=["split"]).to_csv(index=False))
        self.frame.to_csv(self.project / "manifest_split.csv",index=False)

    def tearDown(self):
        for name,digest in self.original_hashes.items():
            self.assertEqual(legacy_file_hash(self.source_paths[name]),digest)
        plt.close("all")
        self.temp.cleanup()

    def create(self, architecture="mobilenet_v3_small", **kwargs):
        filename="mobilenet_model.pth" if architecture=="mobilenet_v3_small" else "efficientnet_model.pth"
        return SavedModelEvaluation(architecture,self.project/filename,self.project,
                                     work_root=self.work,device="cpu",**kwargs)

    def test_six_views_match_existing_api_for_dark_bright_and_small_images(self):
        source=(ROOT/"model/main.py").read_text(encoding="utf-8")
        tree=ast.parse(source)
        definitions=[node for node in tree.body if isinstance(node,ast.FunctionDef) and
                     node.name in {"enhance_image_for_lighting_and_blur","build_tta_batch"}]
        context=self.create()
        namespace={"Image":Image,"ImageEnhance":ImageEnhance,"ImageFilter":ImageFilter,"ImageOps":ImageOps,
                   "torch":torch,"device":torch.device("cpu"),"inference_transforms":context.transform}
        exec(compile(ast.Module(body=definitions,type_ignores=[]),"existing_api_views","exec"),namespace)
        for size,color in [((180,110),(20,30,40)),((110,180),(235,240,245)),((48,60),(70,100,150))]:
            image=Image.new("RGB",size,color)
            image.paste((180,60,90),(0,0,size[0]//3,size[1]))
            image.getexif()[274]=6
            corrected=ImageOps.exif_transpose(image).convert("RGB")
            expected=namespace["build_tta_batch"](corrected)
            actual=torch.stack([context.transform(view) for view in legacy_make_views(image,True)])
            torch.testing.assert_close(actual,expected,rtol=0,atol=0)
            self.assertEqual(len(legacy_make_views(image,False)),1)

    def test_model_caches_labels_and_outputs_are_isolated(self):
        mobile=self.create()
        b0=self.create("efficientnet_b0")
        self.assertNotEqual(mobile.output_dir,b0.output_dir)
        self.assertIsNot(mobile.model,b0.model)
        self.assertIsNot(mobile.results,b0.results)
        self.assertFalse(mobile.holdout_verified)
        with patch.object(torch.optim.AdamW,"step",side_effect=AssertionError("No training allowed")):
            for context in [mobile,b0]:
                before=context.model.classifier[-1].weight.detach().clone()
                single=context.evaluate("val",False)
                tta=context.evaluate("val",True)
                self.assertEqual(single["metrics"]["images"],6)
                self.assertEqual(tta["probabilities"].shape,(6,6))
                torch.testing.assert_close(before,context.model.classifier[-1].weight,rtol=0,atol=0)
                self.assertFalse(context.model.training)
                self.assertTrue(all(parameter.grad is None for parameter in context.model.parameters()))
                with patch.object(context.model,"forward",side_effect=AssertionError("Cache must skip inference")):
                    self.assertTrue(context.evaluate("val",True)["cache_hit"])
        with np.load(str(mobile.results[("val",True)]["prefix"])+"_scores.npz",allow_pickle=False) as saved:
            wrong_paths=saved["paths"].copy()
            wrong_paths[0],wrong_paths[1]=wrong_paths[1],wrong_paths[0]
            scores,targets=saved["scores"],saved["targets"]
        np.savez_compressed(str(mobile.results[("val",True)]["prefix"])+"_scores.npz",scores=scores,targets=targets,paths=wrong_paths)
        with self.assertRaisesRegex(ValueError,"cache"):
            mobile.evaluate("val",True)

    def test_wrong_head_and_conflicting_metadata_are_rejected(self):
        fake=self.project/"not_finetuned.pth"
        torch.save({"classifier.1.weight":torch.zeros(1000,1280)},fake)
        with self.assertRaisesRegex(ValueError,"6"):
            SavedModelEvaluation("efficientnet_b0",fake,self.project,work_root=self.work)
        metadata=self.project/"wrong_metadata.json"
        metadata.write_text(json.dumps({"weights_sha256":"0"*64}),encoding="utf-8")
        with self.assertRaisesRegex(ValueError,"Metadata"):
            self.create(metadata_path=metadata)

    def test_notebook_runtime_guard_stops_before_reading_checkpoint_on_import_failure(self):
        notebook=json.loads((ROOT/"model/b3/DL_EfficientNet_B3_Model.ipynb").read_text(encoding="utf-8"))
        source=next("".join(c["source"]) for c in notebook["cells"] if c["cell_type"]=="code" and
                    "mobilenet_eval = SavedModelEvaluation(" in "".join(c["source"]))
        with patch.object(torch,"load") as load,patch("importlib.import_module",side_effect=AttributeError(
                "partially initialized module 'torch' has no attribute 'library'")):
            with self.assertRaisesRegex(RuntimeError,"Restart session"):
                exec(compile(source,"step20_broken_runtime","exec"),{"PROJECT_DIR":self.project})
            load.assert_not_called()

    def test_notebook_runtime_guard_accepts_healthy_torch_without_loading_weights(self):
        notebook=json.loads((ROOT/"model/b3/DL_EfficientNet_B3_Model.ipynb").read_text(encoding="utf-8"))
        source=next("".join(c["source"]) for c in notebook["cells"] if c["cell_type"]=="code" and
                    "mobilenet_eval = SavedModelEvaluation(" in "".join(c["source"]))
        guard=source.split("from pathlib import Path",1)[0]
        self.assertIn("_ml_importlib",guard)
        fresh={}
        with contextlib.redirect_stdout(io.StringIO()),patch.object(torch,"load") as load:
            exec(compile(guard,"healthy_runtime","exec"),fresh)
            load.assert_not_called()
        self.assertIs(fresh["_ml_torch"],torch)
        self.assertTrue(hasattr(fresh["_ml_torch"],"library"))

    def test_existing_project_photos_run_in_both_modes_without_weight_changes(self):
        photos=sorted((ROOT/"model/learned_data").rglob("*.jpg"))
        self.assertGreaterEqual(len(photos),2)
        for context in [self.create(),self.create("efficientnet_b0")]:
            before=context.model.classifier[-1].weight.detach().clone()
            for photo in photos:
                with Image.open(photo) as image:
                    for mode in [False,True]:
                        result=context.predict_image(image,use_tta=mode)
                        self.assertEqual(set(result["class"]),set(LEGACY_CLASS_NAMES))
                        self.assertTrue(np.isfinite(result["score"]).all())
                        self.assertAlmostEqual(result["score"].sum(),1.0,places=6)
            torch.testing.assert_close(before,context.model.classifier[-1].weight,rtol=0,atol=0)

    def test_split_leakage_and_missing_epoch_history_are_handled(self):
        context=self.create()
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertIsNone(context.show_history())
        self.assertFalse((context.output_dir/"historical_learning_curves.png").exists())
        frame=self.frame.copy()
        frame.loc[frame.index[-1],"group6"]=frame.loc[0,"group6"]
        frame.to_csv(self.project/"manifest_split.csv",index=False)
        with self.assertRaisesRegex(ValueError,"split"):
            legacy_prepare_dataset(self.project,self.project/"manifest_split.csv",self.work)

    def test_notebook_sections_run_independently_with_real_checkpoint_files(self):
        notebook=json.loads((ROOT/"model/b3/DL_EfficientNet_B3_Model.ipynb").read_text(encoding="utf-8"))
        code={cell["metadata"].get("id"):"".join(cell["source"]) for cell in notebook["cells"] if cell["cell_type"]=="code"}
        namespace={"PROJECT_DIR":self.project}
        original_b3_marker=object()
        namespace["model_efficientnet_b3"]=original_b3_marker
        with contextlib.redirect_stdout(io.StringIO()),patch("matplotlib.pyplot.show"),patch.object(
                torch.optim.AdamW,"step",side_effect=AssertionError("Evaluation must not train")):
            # B0 is deliberately run first: it does not depend on MobileNet or B3 setup.
            for architecture,start,variable,prefix in [("efficientnet_b0",30,"efficientnet_b0_eval","EFFICIENTNET_B0"),
                                                       ("mobilenet_v3_small",20,"mobilenet_eval","MOBILENET")]:
                for step in range(start,start+8):
                    source=code[f"{architecture}_{step}_code"]
                    source=source.replace('Path("/content/pet_health_b3")',f"Path({str(self.work)!r})")
                    exec(compile(source,f"notebook_step_{step}","exec"),namespace)
                context=namespace[variable]
                self.assertEqual(set(context.results),{("train",False),("val",False),("val",True),("test",False),("test",True)})
                self.assertTrue((context.output_dir/"summary_single.csv").is_file())
                self.assertTrue((context.output_dir/"summary_tta.csv").is_file())
                self.assertEqual(len(list(context.output_dir.glob("*_overall.png"))),5)
                with zipfile.ZipFile(namespace[f"{prefix}_REPORT_ZIP"]) as archive:
                    saved_metadata=json.loads(archive.read("evaluation_metadata.json"))
                    self.assertEqual(saved_metadata["architecture"],architecture)
                    self.assertIn("test_six_view_v1_classification_report.csv",archive.namelist())
                    self.assertFalse(any(name.endswith(".pth") for name in archive.namelist()))
                prediction=context.predict_image(Image.new("RGB",(100,120),(70,100,130)),True)
                self.assertEqual(len(prediction),6)
                self.assertAlmostEqual(prediction["score"].sum(),1,places=6)
        self.assertIs(namespace["model_efficientnet_b3"],original_b3_marker)
        self.assertNotEqual(namespace["mobilenet_eval"].output_dir,namespace["efficientnet_b0_eval"].output_dir)


if __name__=="__main__":
    unittest.main()
