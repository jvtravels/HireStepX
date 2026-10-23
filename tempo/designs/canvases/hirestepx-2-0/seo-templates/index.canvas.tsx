import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { SeoArticleDesktop, SeoArticleMobile, SeoSalaryDesktop, SeoSalaryMobile, SeoQuestionsDesktop, SeoQuestionsMobile } from "@/home2/PagesFrames";

export default function SeoTemplatesCanvas() {
  return (
    <Canvas name="seo-templates" backgroundColor="#232323">
      <Storyboard id="ArticleDesktop" name="Article / guide (desktop)" component={SeoArticleDesktop} layout={{ x: 0, y: 0, width: 1728, height: 6000, intrinsicSizing: "root-element" }} />
      <Storyboard id="ArticleMobile" name="Article / guide (mobile)" component={SeoArticleMobile} layout={{ x: 1778, y: 0, width: 390, height: 6000, intrinsicSizing: "root-element" }} />
      <Storyboard id="SalaryDesktop" name="Salary page (desktop)" component={SeoSalaryDesktop} layout={{ x: 2318, y: 0, width: 1728, height: 4000, intrinsicSizing: "root-element" }} />
      <Storyboard id="SalaryMobile" name="Salary page (mobile)" component={SeoSalaryMobile} layout={{ x: 4096, y: 0, width: 390, height: 4000, intrinsicSizing: "root-element" }} />
      <Storyboard id="QuestionsDesktop" name="Question set / company guide (desktop)" component={SeoQuestionsDesktop} layout={{ x: 4636, y: 0, width: 1728, height: 4000, intrinsicSizing: "root-element" }} />
      <Storyboard id="QuestionsMobile" name="Question set / company guide (mobile)" component={SeoQuestionsMobile} layout={{ x: 6414, y: 0, width: 390, height: 4000, intrinsicSizing: "root-element" }} />
    </Canvas>
  );
}
